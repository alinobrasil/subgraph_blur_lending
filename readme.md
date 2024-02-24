
### Background Info
This is based on a previous graph I built, with significant changes added. It captures events from Blend (Blur's lending contract) to identify when a loan has initiated the liquidation process for NFT collateral. Relevant smart contracts can be found in the `extras` folder.

Previously, it only organized events into Lien & Loan entities. It also didn't offer a way to easily track repayments or borrowers. Today I've added these changes:
## Using File Data Sources for token metadata
- Token entity tracks individual tokens. TokenMetadata entity uses file data sources to fetch NFT attributes from IPFS for Bored Apes Yacht Club (BAYC), the most traded NFT collection on Blur. The mapping file `blend.ts` identifies each attribute and maps to the correct field in the TokenMetadata entity.

## Reverse lookups on Borrower 
The Borrower is a new entity. It uses reverse lookups (derived field) to identify all liens (collateral) associated with any borrower. Similarly it the payments field is derived from Repayments.
Now, it's easy to find any borrower and identify
 - all NFTs they've used as collateral for loans
 - all payments they've made (previously this would not have been possible as some funny math is required). The Repayment entity was created to enable this.

 ## Accurate tracking of lien status
  - Easily determine status of lien: whether a loan is still active or if if it has ended by either full repayment or seizure of collateral. Now, the mapping file `blend.ts` contains logic in event handlers for these events: LoanOfferTaken, StartAuction and Seizure. 
  - A new status field replaced some redundant fields. A simple status query will now show whether the lien is active, repaid or seized.



----
### Appendix
Discovered some issues with FDS related tutorials:
 - Created issue for FDS tutorial: https://github.com/marcusrein/FDS-Workshop-Repo-2023/issues/2
 - The [Arweave/IPFS tutorial](https://thegraph.com/blog/file-data-sources-tutorial/) is based on Lens-Hub contract. There's a new implementation contract from last week with a few breaking changes. Here's [my implementation](https://github.com/alinobrasil/subgraph_fds_lenshub) for now.  Will look into Issue/PR later.