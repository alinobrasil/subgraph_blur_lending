
import {
  LoanOfferTaken,
  Repay,
  Seize,
  StartAuction
} from "../generated/Blend/Blend"

import {
  Lien,
  Loan,
  Token,
  TokenMetaData,
  Borrower,
  Repayment
} from "../generated/schema"

import { TokenMetadata as TokenMetadataTemplate } from "../generated/templates";
import { json, Bytes, dataSource } from "@graphprotocol/graph-ts";

const ipfsBayc = "QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq";

// LoanOfferTaken is an event emitted to deal with many scenarios:
// 1. brand new lien. corresponding loan is new too. 
// 2. borrower repays some money, so loan amount is updated. no new loan is created.
// 3. new loan created on existing lien. (eg. new terms, new lender and/or new amount)
// Handle accordingly: organize data into Lien and Loan
export function handleLoanOfferTaken(event: LoanOfferTaken): void {

  const lienId = event.params.lienId.toString()


  //initialize lien, loanAmount, rate, lender to be used across all scenarios
  const loanAmount = event.params.loanAmount
  const rate = event.params.rate
  const lender = event.params.lender
  // try to obtain lienId: see if it's already indexed
  let lien = Lien.load(lienId)

  //scenario1: brand new lien. create new lien & loan -----------------------------------
  if (!lien) {
    lien = new Lien(lienId)

    lien.collection = event.params.collection
    lien.tokenId = event.params.tokenId
    lien.borrower = event.params.borrower.toHexString();
    lien.timeStarted = event.block.timestamp
    lien.auctionDuration = event.params.auctionDuration
    // lien.active = true
    lien.status = "active";

    let loansLength = 0;

    // let loan = new Loan(lender.toHexString() + "_" + rate.toHexString() + "_" + loanAmount.toHexString())
    let loan = new Loan(lien.id + "_" + loansLength.toString())
    loan.lien = lienId   // links to parent lien
    loan.lienId = lienId
    loan.lender = lender
    loan.loanAmount = loanAmount
    loan.rate = rate
    loan.startTime = event.block.timestamp
    loan.save()

    // lien.loans = [loan.id]
    lien.save()


    //create a token entity for BAYC
    let collectionAddress = lien.collection.toHexString()
    if (collectionAddress.toLowerCase() == "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d") {
      let token = Token.load(lien.collection.toHexString() + "_" + lien.tokenId.toString())
      if (!token) {
        token = new Token(lien.collection.toHexString() + "_" + lien.tokenId.toString())
        token.collection = lien.collection
        token.tokenId = lien.tokenId
        token.lien = lien.id // assign lien to this
        token.uri = ipfsBayc + "/" + event.params.tokenId.toString();
        TokenMetadataTemplate.create(token.uri);
      }
      token.save()
    }

    //create borrower entity if not exists
    let borrower = Borrower.load(lien.borrower)
    if (!borrower) {
      borrower = new Borrower(lien.borrower)
      borrower.save()
    }

  }
  else { //if lien already exists: handle 2 other scenarios

    let loans = lien.loans.load()
    let loansLength = loans.length  //prior to setting this length variable, the loop was running infinitely.

    // update lien associated with this token
    let token = Token.load(lien.collection.toString() + "_" + lien.tokenId.toString())
    if (token) {
      token.lien = lien.id
    }


    for (let i = 0; i < loansLength; i++) {
      let item = Loan.load(loans[i].id)

      if (item) {
        // scenario 2: same term. update loan amount (borrower paid back some money, not all) -----------------------
        if (item.lender == lender && item.rate == rate && item.loanAmount != loanAmount) {
          item.loanAmount = loanAmount
          item.save()

          //update lien status
          lien.status = "repaid"; //repaid in full. lien no longer active     
          lien.save()

          // create repayment record: partial repayment
          let repayment = new Repayment(event.transaction.hash.toHexString() + "_" + lienId);
          repayment.lien = lien.id;
          let repaidAmount = loanAmount.toU64() - item.loanAmount.toU64();
          repayment.time = event.block.timestamp;
          repayment.borrower = lien.borrower;



        } else {
          // scenario 3: some term changed. create new loan.----------------------------------------
          // let loan = new Loan(lender.toHexString() + "_" + rate.toHexString() + "_" + loanAmount.toHexString())
          let loan = new Loan(lien.id + "_" + loansLength.toString())
          loan.lien = lienId
          loan.lienId = lienId
          loan.lender = lender
          loan.loanAmount = loanAmount
          loan.rate = rate
          loan.startTime = event.block.timestamp
          loan.save()

          //reset auction start, assuming new loan was taken on existing lien
          lien.auctionStarted = null

          lien.save()
        }
      }
    }
  } // end handling 3 scenarios. lien saved.



}

export function handleMetadata(content: Bytes): void {
  let tokenMetadata = new TokenMetaData(dataSource.stringParam());
  const value = json.fromBytes(content).toObject();

  if (value) {
    const image = value.get("image");
    const attributes = value.get("attributes");

    if (image && attributes) {
      tokenMetadata.image = image.toString();
      const attributesArray = attributes.toArray();
      if (attributesArray) {
        for (let i = 0; i < attributesArray.length; i++) {
          const attributeObject = attributesArray[i].toObject();
          const trait_type = attributeObject.get("trait_type");
          const value = attributeObject.get("value");
          if (trait_type && value) {

            const theTrait = trait_type.toString();
            const theValue = value.toString();

            if (theTrait == "Earring") {
              tokenMetadata.earring = theValue;
            } else if (theTrait == "Background") {
              tokenMetadata.background = theValue;
            }
            else if (theTrait == "Fur") {
              tokenMetadata.fur = theValue;
            }
            else if (theTrait == "Eyes") {
              tokenMetadata.eyes = theValue;
            }
            else if (theTrait == "Mouth") {
              tokenMetadata.mouth = theValue;
            }
            else if (theTrait == "Hat") {
              tokenMetadata.hat = theValue;
            }
            else if (theTrait == "Clothes") {
              tokenMetadata.clothes = theValue;
            }

          }
        }
        tokenMetadata.save();
      }
    }

  }
}


// track when repay event was triggered (loan repaid in full)
export function handleRepay(event: Repay): void {
  const lienId = event.params.lienId.toString()

  let lien = Lien.load(lienId.toString())
  if (lien) {
    // lien.repayTime = event.block.timestamp
    lien.status = "repaid";
    lien.save()


    let loans = lien.loans.load()
    let loansLength = loans.length

    //get full loan amount
    let lastLoan = Loan.load(loans[loansLength - 1].id)

    //create repayment record, using full amount
    if (lastLoan) {
      // create repayment entity
      let repayment = new Repayment(event.transaction.hash.toHexString() + "_" + lienId);
      repayment.lien = lien.id;
      let repaidAmount = lastLoan.loanAmount;
      repayment.repaidAmount = repaidAmount;
      repayment.time = event.block.timestamp;
      repayment.borrower = lien.borrower;
      repayment.save()
    }
  }
}

// track when SEIZE event was triggered
export function handleSeize(event: Seize): void {
  const lienId = event.params.lienId

  let lien = Lien.load(lienId.toString())
  if (lien) {
    // lien.seizeTime = event.block.timestamp
    lien.status = "seized";
    lien.save()
  }
}

export function handleStartAuction(event: StartAuction): void {
  // log.warning("Found StartAuction Event {}", [ event.params.lienId.toString() ])
  const lienId = event.params.lienId

  let lien = Lien.load(lienId.toString())
  if (lien) {
    lien.auctionStarted = event.block.timestamp
    lien.save()
  }
}

