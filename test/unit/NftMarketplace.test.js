const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat.config");

!developmentChains.includes(network.name)
	? describe.skip
	: describe("NFT Marketplace Unit Tests", function () {
			let nftMarketplace, nftMarketplaceContract, basicNft, basicNftContract;
			const PRICE = ethers.utils.parseEther("0.1");
			const TOKEN_ID = 0;

			beforeEach(async () => {
				accounts = await ethers.getSigners();
				deployer = accounts[0];
				user = accounts[1];
				await deployments.fixture(["all"]);
				nftMarketplaceContract = await ethers.getContract("NftMarketplace");
				nftMarketplace = nftMarketplaceContract.connect(deployer);
				basicNftContract = await ethers.getContract("BasicNft");
				basicNft = await basicNftContract.connect(deployer);
				await basicNft.mintNft();
				await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID);
			});

			describe("listItem", function () {
				it("reverts if the item is already listed", async function () {
					await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
					await expect(
						nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
					).to.be.revertedWith("NftMarketplace__AlreadyListed");
				});
				it("reverts if the sender is not owner", async function () {
					nftMarketplace = nftMarketplaceContract.connect(user);
					await expect(
						nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
					).to.be.revertedWith("NftMarketplace__NotOwner");
				});
				it("reverts when price is equal to zero", async function () {
					await expect(
						nftMarketplace.listItem(basicNft.address, TOKEN_ID, "0")
					).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero");
				});
				it("reverts if the NFT is not approved", async function () {
					await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID);
					await expect(
						nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
					).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace");
				});
				it("emits an event upon successful listing", async function () {
					await expect(
						nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
					).to.emit(nftMarketplace, "ItemListed");
				});
				it("updates listings with new NFT", async function () {
					await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
					const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);
					assert.equal(listing.price.toString(), PRICE);
					assert.equal(listing.seller.toString(), deployer.address);
				});
			});

			describe("buyItem", function () {
				it("reverts if the item is not listed", async function () {
					await expect(
						nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
					).to.be.revertedWith("NftMarketplace__NotListed");
				});
				it("reverts if the value sent does not meet the price", async function () {
					await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
					await expect(
						nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
					).to.be.revertedWith("NftMarketplace__PriceNotMet");
				});
				it("transfers NFT to the buyer and updates internal proceeds", async function () {
					await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
					nftMarketplace = nftMarketplaceContract.connect(user);
					await expect(
						nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
					).to.emit(nftMarketplace, "ItemBought");
					const newOwner = await basicNft.ownerOf(TOKEN_ID);
					const deployerProceeds = await nftMarketplace.getProceeds(deployer.address);
					assert.equal(newOwner, user.address);
					assert.equal(deployerProceeds.toString(), PRICE.toString());
				});
			});
	  });
