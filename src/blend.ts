import { BigInt, log } from "@graphprotocol/graph-ts"

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
  TokenMetaData
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

  const loanAmount = event.params.loanAmount
  const rate = event.params.rate
  const lender = event.params.lender

  // try to obtain lienId: see if it's already indexed
  let lien = Lien.load(lienId)

  //scenario1: brand new lien. create new lien & loan
  if (!lien) {
    lien = new Lien(lienId)

    lien.collection = event.params.collection
    lien.tokenId = event.params.tokenId
    lien.borrower = event.params.borrower
    lien.timeStarted = event.block.timestamp
    lien.auctionDuration = event.params.auctionDuration

    let loan = new Loan(lender.toHexString() + "_" + rate.toHexString() + "_" + loanAmount.toHexString())
    loan.lien = lienId   // links to parent lien
    loan.lienId = lienId
    loan.lender = lender
    loan.loanAmount = loanAmount
    loan.rate = rate
    loan.startTime = event.block.timestamp
    loan.save()

    // lien.loans = [loan.id]
    lien.save()


    //create a token entity
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

  else {

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
        // scenario 2: same term. update loan amount (borrower paid back some money)
        if (item.lender == lender && item.rate == rate && item.loanAmount != loanAmount) {
          item.loanAmount = loanAmount
          item.save()
        } else {
          // scenario 3: some term changed. create new loan.
          let loan = new Loan(lender.toHexString() + "_" + rate.toHexString() + "_" + loanAmount.toHexString())
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
  }
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


// track when repay event was triggered
export function handleRepay(event: Repay): void {
  const lienId = event.params.lienId

  let lien = Lien.load(lienId.toString())
  if (lien) {
    lien.repayTime = event.block.timestamp
    lien.save()
  }
}

// track when SEIZE event was triggered
export function handleSeize(event: Seize): void {
  const lienId = event.params.lienId

  let lien = Lien.load(lienId.toString())
  if (lien) {
    lien.seizeTime = event.block.timestamp
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

