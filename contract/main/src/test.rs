#![cfg(test)]

use super::{Campaign, CharityMatch, CharityMatchClient, Error, Status};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env, String,
};

const DEADLINE: u64 = 86_400;
const CAP: i128 = 100_000_000;

fn setup<'a>() -> (
    Env,
    CharityMatchClient<'a>,
    u32,
    Address,
    Address,
    StellarAssetClient<'a>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let xlm_sac = env.register_stellar_asset_contract_v2(issuer);
    let xlm_addr = xlm_sac.address();
    let xlm_admin = StellarAssetClient::new(&env, &xlm_addr);

    let charity = Address::generate(&env);
    let sponsor = Address::generate(&env);
    xlm_admin.mint(&sponsor, &CAP);

    let contract_id = env.register(CharityMatch, (xlm_addr,));
    let client = CharityMatchClient::new(&env, &contract_id);

    let title = String::from_str(&env, "School Lunches");
    let cid = client.create_campaign(&sponsor, &charity, &title, &CAP, &DEADLINE);

    (env, client, cid, charity, sponsor, xlm_admin)
}

fn advance(env: &Env, secs: u64) {
    env.ledger().with_mut(|li| li.timestamp = li.timestamp.saturating_add(secs));
}

#[test]
fn donations_are_matched_one_to_one() {
    let (env, c, cid, _, _, xlm_admin) = setup();
    let alice = Address::generate(&env);
    xlm_admin.mint(&alice, &30_000_000);
    let m = c.donate(&cid, &alice, &30_000_000);
    assert_eq!(m, 30_000_000);
    let info: Campaign = c.info(&cid);
    assert_eq!(info.donated, 30_000_000);
    assert_eq!(info.matched, 30_000_000);
}

#[test]
fn matching_caps_at_sponsor_limit() {
    let (env, c, cid, _, _, xlm_admin) = setup();
    let alice = Address::generate(&env);
    xlm_admin.mint(&alice, &200_000_000);
    let m1 = c.donate(&cid, &alice, &80_000_000);
    let m2 = c.donate(&cid, &alice, &50_000_000);
    assert_eq!(m1, 80_000_000);
    assert_eq!(m2, 20_000_000);
    let info: Campaign = c.info(&cid);
    assert_eq!(info.matched, CAP);
}

#[test]
fn unique_donor_count_dedupes() {
    let (env, c, cid, _, _, xlm_admin) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    xlm_admin.mint(&alice, &50_000_000);
    xlm_admin.mint(&bob, &50_000_000);
    c.donate(&cid, &alice, &10_000_000);
    c.donate(&cid, &alice, &10_000_000);
    c.donate(&cid, &bob, &5_000_000);
    let info: Campaign = c.info(&cid);
    assert_eq!(info.donors, 2);
}

#[test]
fn donations_after_deadline_blocked() {
    let (env, c, cid, _, _, xlm_admin) = setup();
    let alice = Address::generate(&env);
    xlm_admin.mint(&alice, &10_000_000);
    advance(&env, DEADLINE + 1);
    let r = c.try_donate(&cid, &alice, &10_000_000);
    assert!(matches!(r, Err(Ok(Error::DeadlinePassed))));
}

#[test]
fn sponsor_closes_and_payout_is_donated_plus_matched() {
    let (env, c, cid, _, sponsor, xlm_admin) = setup();
    let alice = Address::generate(&env);
    xlm_admin.mint(&alice, &40_000_000);
    c.donate(&cid, &alice, &40_000_000);
    let payout = c.close(&cid, &sponsor);
    assert_eq!(payout, 80_000_000);
    let info: Campaign = c.info(&cid);
    assert_eq!(info.status, Status::Closed);
}

#[test]
fn non_sponsor_cannot_close() {
    let (env, c, cid, _, _, _) = setup();
    let stranger = Address::generate(&env);
    let r = c.try_close(&cid, &stranger);
    assert!(matches!(r, Err(Ok(Error::NotSponsor))));
}

#[test]
fn refund_when_deadline_passes_without_close() {
    let (env, c, cid, _, _, xlm_admin) = setup();
    let alice = Address::generate(&env);
    xlm_admin.mint(&alice, &10_000_000);
    c.donate(&cid, &alice, &10_000_000);
    advance(&env, DEADLINE + 1);
    let r = c.refund(&cid, &alice);
    assert_eq!(r, 10_000_000);
    assert!(c.is_refunded(&cid, &alice));
}

#[test]
fn cannot_refund_after_close() {
    let (env, c, cid, _, sponsor, xlm_admin) = setup();
    let alice = Address::generate(&env);
    xlm_admin.mint(&alice, &10_000_000);
    c.donate(&cid, &alice, &10_000_000);
    c.close(&cid, &sponsor);
    advance(&env, DEADLINE + 1);
    let r = c.try_refund(&cid, &alice);
    assert!(matches!(r, Err(Ok(Error::AlreadyClosed))));
}

#[test]
fn create_campaign_increments_id_and_list() {
    let (env, c, cid, charity, sponsor, xlm_admin) = setup();
    assert_eq!(cid, 0);
    let charity2 = Address::generate(&env);
    xlm_admin.mint(&sponsor, &CAP);
    let title2 = String::from_str(&env, "Food Bank");
    let cid2 = c.create_campaign(&sponsor, &charity2, &title2, &CAP, &DEADLINE);
    assert_eq!(cid2, 1);
    let ids = c.list_campaigns();
    assert_eq!(ids.len(), 2);
    let _ = charity;
}
