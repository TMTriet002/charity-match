#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token,
    Address, Env, String,
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
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Status {
    Open = 0,
    Closed = 1,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Xlm,
    Charity,
    Sponsor,
    Title,
    MatchCap,
    Donated,
    Matched,
    Deadline,
    Status,
    Donors,
    Donation(Address),
    Refunded(Address),
}

fn xlm_client(env: &Env) -> Result<token::Client<'_>, Error> {
    let addr: Address = env
        .storage()
        .instance()
        .get(&DataKey::Xlm)
        .ok_or(Error::NotInitialized)?;
    Ok(token::Client::new(env, &addr))
}

#[contract]
pub struct CharityMatch;

#[contractimpl]
impl CharityMatch {
    pub fn __constructor(
        env: Env,
        xlm: Address,
        charity: Address,
        sponsor: Address,
        title: String,
        match_cap: i128,
        deadline: u64,
    ) {
        sponsor.require_auth();
        env.storage().instance().set(&DataKey::Xlm, &xlm);
        env.storage().instance().set(&DataKey::Charity, &charity);
        env.storage().instance().set(&DataKey::Sponsor, &sponsor);
        env.storage().instance().set(&DataKey::Title, &title);
        env.storage().instance().set(&DataKey::MatchCap, &match_cap);
        env.storage().instance().set(&DataKey::Donated, &0_i128);
        env.storage().instance().set(&DataKey::Matched, &0_i128);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::Status, &Status::Open);
        env.storage().instance().set(&DataKey::Donors, &0_u32);

        // sponsor escrows the full match cap up front
        if match_cap > 0 {
            let t = token::Client::new(&env, &xlm);
            t.transfer(&sponsor, &env.current_contract_address(), &match_cap);
        }
    }

    pub fn donate(env: Env, donor: Address, amount: i128) -> Result<i128, Error> {
        donor.require_auth();
        if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }
        let status: Status = env
            .storage()
            .instance()
            .get(&DataKey::Status)
            .ok_or(Error::NotInitialized)?;
        if status != Status::Open {
            return Err(Error::AlreadyClosed);
        }
        let deadline: u64 = env
            .storage()
            .instance()
            .get(&DataKey::Deadline)
            .ok_or(Error::NotInitialized)?;
        if env.ledger().timestamp() >= deadline {
            return Err(Error::DeadlinePassed);
        }

        let cap: i128 = env.storage().instance().get(&DataKey::MatchCap).unwrap_or(0);
        let matched: i128 = env.storage().instance().get(&DataKey::Matched).unwrap_or(0);
        let remaining = cap - matched;
        let match_amount = if remaining > 0 {
            if amount < remaining { amount } else { remaining }
        } else {
            0
        };

        let donated: i128 = env.storage().instance().get(&DataKey::Donated).unwrap_or(0);
        env.storage().instance().set(&DataKey::Donated, &(donated + amount));
        env.storage()
            .instance()
            .set(&DataKey::Matched, &(matched + match_amount));

        let key = DataKey::Donation(donor.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let first = prev == 0;
        env.storage().persistent().set(&key, &(prev + amount));

        if first {
            let donors: u32 = env.storage().instance().get(&DataKey::Donors).unwrap_or(0);
            env.storage().instance().set(&DataKey::Donors, &(donors + 1));
        }

        let t = xlm_client(&env)?;
        t.transfer(&donor, &env.current_contract_address(), &amount);

        env.events()
            .publish((symbol_short!("donate"), donor), (amount, match_amount));
        Ok(match_amount)
    }

    pub fn close(env: Env, sponsor: Address) -> Result<i128, Error> {
        let stored: Address = env
            .storage()
            .instance()
            .get(&DataKey::Sponsor)
            .ok_or(Error::NotInitialized)?;
        if stored != sponsor {
            return Err(Error::NotSponsor);
        }
        sponsor.require_auth();
        let status: Status = env
            .storage()
            .instance()
            .get(&DataKey::Status)
            .ok_or(Error::NotInitialized)?;
        if status != Status::Open {
            return Err(Error::AlreadyClosed);
        }
        let donated: i128 = env.storage().instance().get(&DataKey::Donated).unwrap_or(0);
        let matched: i128 = env.storage().instance().get(&DataKey::Matched).unwrap_or(0);
        let payout = donated + matched;

        env.storage().instance().set(&DataKey::Status, &Status::Closed);
        let charity: Address = env
            .storage()
            .instance()
            .get(&DataKey::Charity)
            .ok_or(Error::NotInitialized)?;

        let cap: i128 = env.storage().instance().get(&DataKey::MatchCap).unwrap_or(0);
        let unused_match = cap - matched;

        let t = xlm_client(&env)?;
        t.transfer(&env.current_contract_address(), &charity, &payout);
        if unused_match > 0 {
            t.transfer(&env.current_contract_address(), &sponsor, &unused_match);
        }

        env.events()
            .publish((symbol_short!("close"), charity), payout);
        Ok(payout)
    }

    pub fn refund(env: Env, donor: Address) -> Result<i128, Error> {
        donor.require_auth();
        let status: Status = env
            .storage()
            .instance()
            .get(&DataKey::Status)
            .ok_or(Error::NotInitialized)?;
        if status == Status::Closed {
            return Err(Error::AlreadyClosed);
        }
        let deadline: u64 = env
            .storage()
            .instance()
            .get(&DataKey::Deadline)
            .ok_or(Error::NotInitialized)?;
        if env.ledger().timestamp() < deadline {
            return Err(Error::DeadlineNotPassed);
        }
        if env.storage().persistent().has(&DataKey::Refunded(donor.clone())) {
            return Err(Error::AlreadyRefunded);
        }
        let amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Donation(donor.clone()))
            .ok_or(Error::NoDonation)?;
        if amount <= 0 {
            return Err(Error::NoDonation);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Refunded(donor.clone()), &true);

        let t = xlm_client(&env)?;
        t.transfer(&env.current_contract_address(), &donor, &amount);

        env.events()
            .publish((symbol_short!("refund"), donor), amount);
        Ok(amount)
    }

    pub fn info(
        env: Env,
    ) -> (Address, Address, String, i128, i128, i128, u64, u32, Status) {
        let charity: Address = env
            .storage()
            .instance()
            .get(&DataKey::Charity)
            .unwrap();
        let sponsor: Address = env
            .storage()
            .instance()
            .get(&DataKey::Sponsor)
            .unwrap();
        let title: String = env
            .storage()
            .instance()
            .get(&DataKey::Title)
            .unwrap_or_else(|| String::from_str(&env, ""));
        let match_cap: i128 = env.storage().instance().get(&DataKey::MatchCap).unwrap_or(0);
        let donated: i128 = env.storage().instance().get(&DataKey::Donated).unwrap_or(0);
        let matched: i128 = env.storage().instance().get(&DataKey::Matched).unwrap_or(0);
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap_or(0);
        let donors: u32 = env.storage().instance().get(&DataKey::Donors).unwrap_or(0);
        let status: Status = env
            .storage()
            .instance()
            .get(&DataKey::Status)
            .unwrap_or(Status::Open);
        (charity, sponsor, title, match_cap, donated, matched, deadline, donors, status)
    }

    pub fn donation_of(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Donation(donor))
            .unwrap_or(0)
    }

    pub fn refunded(env: Env, donor: Address) -> bool {
        env.storage().persistent().has(&DataKey::Refunded(donor))
    }
}

#[cfg(test)]
mod test;
