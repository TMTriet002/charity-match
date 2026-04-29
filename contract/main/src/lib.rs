#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token,
    Address, Env, String, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AmountMustBePositive = 2,
    DeadlinePassed = 3,
    DeadlineNotPassed = 4,
    AlreadyClosed = 5,
    AlreadyRefunded = 6,
    NotSponsor = 7,
    NoDonation = 8,
    CampaignNotFound = 9,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Open = 0,
    Closed = 1,
}

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub charity: Address,
    pub sponsor: Address,
    pub title: String,
    pub match_cap: i128,
    pub donated: i128,
    pub matched: i128,
    pub deadline: u64,
    pub donors: u32,
    pub status: Status,
}

#[contracttype]
#[derive(Clone)]
pub struct DonorKey {
    pub campaign_id: u32,
    pub donor: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Xlm,
    NextId,
    Campaign(u32),
    Donation(DonorKey),
    Refunded(DonorKey),
}

fn xlm_client(env: &Env) -> Result<token::Client<'_>, Error> {
    let addr: Address = env
        .storage()
        .instance()
        .get(&DataKey::Xlm)
        .ok_or(Error::NotInitialized)?;
    Ok(token::Client::new(env, &addr))
}

fn load(env: &Env, id: u32) -> Result<Campaign, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Campaign(id))
        .ok_or(Error::CampaignNotFound)
}

fn save(env: &Env, id: u32, c: &Campaign) {
    env.storage().persistent().set(&DataKey::Campaign(id), c);
}

#[contract]
pub struct CharityMatch;

#[contractimpl]
impl CharityMatch {
    pub fn __constructor(env: Env, xlm: Address) {
        env.storage().instance().set(&DataKey::Xlm, &xlm);
        env.storage().instance().set(&DataKey::NextId, &0u32);
    }

    pub fn create_campaign(
        env: Env,
        sponsor: Address,
        charity: Address,
        title: String,
        match_cap: i128,
        deadline: u64,
    ) -> Result<u32, Error> {
        sponsor.require_auth();
        if match_cap < 0 {
            return Err(Error::AmountMustBePositive);
        }

        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        let campaign = Campaign {
            charity: charity.clone(),
            sponsor: sponsor.clone(),
            title,
            match_cap,
            donated: 0,
            matched: 0,
            deadline,
            donors: 0,
            status: Status::Open,
        };
        save(&env, id, &campaign);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        if match_cap > 0 {
            xlm_client(&env)?.transfer(&sponsor, &env.current_contract_address(), &match_cap);
        }

        env.events()
            .publish((symbol_short!("create"), id), match_cap);

        Ok(id)
    }

    pub fn donate(env: Env, campaign_id: u32, donor: Address, amount: i128) -> Result<i128, Error> {
        donor.require_auth();
        if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }
        let mut c = load(&env, campaign_id)?;
        if c.status != Status::Open {
            return Err(Error::AlreadyClosed);
        }
        if env.ledger().timestamp() >= c.deadline {
            return Err(Error::DeadlinePassed);
        }

        let remaining = c.match_cap - c.matched;
        let match_amount = if remaining > 0 {
            if amount < remaining { amount } else { remaining }
        } else {
            0
        };

        c.donated += amount;
        c.matched += match_amount;

        let dk = DataKey::Donation(DonorKey { campaign_id, donor: donor.clone() });
        let prev: i128 = env.storage().persistent().get(&dk).unwrap_or(0);
        if prev == 0 {
            c.donors += 1;
        }
        env.storage().persistent().set(&dk, &(prev + amount));
        save(&env, campaign_id, &c);

        xlm_client(&env)?.transfer(&donor, &env.current_contract_address(), &amount);

        env.events()
            .publish((symbol_short!("donate"), campaign_id, donor), (amount, match_amount));
        Ok(match_amount)
    }

    pub fn close(env: Env, campaign_id: u32, sponsor: Address) -> Result<i128, Error> {
        let mut c = load(&env, campaign_id)?;
        if c.sponsor != sponsor {
            return Err(Error::NotSponsor);
        }
        sponsor.require_auth();
        if c.status != Status::Open {
            return Err(Error::AlreadyClosed);
        }

        let payout = c.donated + c.matched;
        let unused = c.match_cap - c.matched;
        let charity = c.charity.clone();
        c.status = Status::Closed;
        save(&env, campaign_id, &c);

        let t = xlm_client(&env)?;
        if payout > 0 {
            t.transfer(&env.current_contract_address(), &charity, &payout);
        }
        if unused > 0 {
            t.transfer(&env.current_contract_address(), &sponsor, &unused);
        }

        env.events()
            .publish((symbol_short!("close"), campaign_id, charity), payout);
        Ok(payout)
    }

    pub fn refund(env: Env, campaign_id: u32, donor: Address) -> Result<i128, Error> {
        donor.require_auth();
        let c = load(&env, campaign_id)?;
        if c.status == Status::Closed {
            return Err(Error::AlreadyClosed);
        }
        if env.ledger().timestamp() < c.deadline {
            return Err(Error::DeadlineNotPassed);
        }
        let rk = DataKey::Refunded(DonorKey { campaign_id, donor: donor.clone() });
        if env.storage().persistent().has(&rk) {
            return Err(Error::AlreadyRefunded);
        }
        let dk = DataKey::Donation(DonorKey { campaign_id, donor: donor.clone() });
        let amount: i128 = env
            .storage()
            .persistent()
            .get(&dk)
            .ok_or(Error::NoDonation)?;
        if amount <= 0 {
            return Err(Error::NoDonation);
        }

        env.storage().persistent().set(&rk, &true);
        xlm_client(&env)?.transfer(&env.current_contract_address(), &donor, &amount);

        env.events()
            .publish((symbol_short!("refund"), campaign_id, donor), amount);
        Ok(amount)
    }

    pub fn info(env: Env, campaign_id: u32) -> Result<Campaign, Error> {
        load(&env, campaign_id)
    }

    pub fn list_campaigns(env: Env) -> Vec<u32> {
        let next: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        let mut ids = Vec::new(&env);
        for i in 0..next {
            ids.push_back(i);
        }
        ids
    }

    pub fn donation_of(env: Env, campaign_id: u32, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Donation(DonorKey { campaign_id, donor }))
            .unwrap_or(0)
    }

    pub fn is_refunded(env: Env, campaign_id: u32, donor: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Refunded(DonorKey { campaign_id, donor }))
    }
}

#[cfg(test)]
mod test;
