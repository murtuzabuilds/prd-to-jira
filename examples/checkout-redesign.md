# Checkout Redesign (sample PRD)

## Problem
38% of carts are abandoned at the payment step on mobile. Session recordings show people re-typing card details and leaving when shipping costs appear late.

## Goals
- Cut mobile checkout abandonment
- Make total cost visible before payment

## Success metrics
- Mobile checkout abandonment from 38% to 28% by end of Q2
- Median time to purchase under 90 seconds

## Wallet payments
Let returning customers pay without typing card details.
- [P0] Add Apple Pay and Google Pay on the payment step (5 pts) #payments
  - Wallet buttons appear only on supported devices
  - Successful wallet payment creates the order and shows confirmation
  - Failed wallet payment falls back to the card form with a clear message
- [P1] Save card for next time with explicit opt-in (3 pts) #payments
  - Checkbox is unticked by default
  - Saved card shows last four digits and expiry

## Cost transparency
- [P0] Show shipping and tax estimate in the cart (3 pts)
  - Estimate uses the postcode if known, otherwise a default region
  - Estimate label says "estimated" until the address is entered
- [P1] Free-shipping progress bar in cart (2 pts)
  - Bar shows the amount left to reach free shipping

## Guest checkout
- [P1] Make the checkout flow seamless for guests (13 pts)

## Out of scope
- Buy now, pay later providers
- Changes to the returns policy

## Risks
- Wallet approval by the payments provider may take two weeks
