import { FHECounter, FHECounter__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHECounter")) as FHECounter__factory;
  const fheCounterContract = (await factory.deploy()) as FHECounter;
  const fheCounterContractAddress = await fheCounterContract.getAddress();

  return { fheCounterContract, fheCounterContractAddress };
}

describe("FHECounter", function () {
  let signers: Signers;
  let fheCounterContract: FHECounter;
  let fheCounterContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async () => {
    ({ fheCounterContract, fheCounterContractAddress } = await deployFixture());
  });

  it("should be deployed", async function () {
    console.log(`FHECounter has been deployed at address ${fheCounterContractAddress}`);
    expect(ethers.isAddress(fheCounterContractAddress)).to.eq(true);
  });

  it("encrypted count should be uninitialized after deployment", async function () {
    const encryptedCount = await fheCounterContract.getCount();
    expect(encryptedCount).to.eq(ethers.ZeroHash);
  });

  it("increment the counter by 1", async function () {
    const encryptedCountBeforeInc = await fheCounterContract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);
    const clearCountBeforeInc = 0;

    // Encrypt 1 as euint32
    const clearOne = 1;
    const encryptedOne = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(clearOne)
      .encrypt();

    // Increment
    const tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    // Check the result (decrypt)
    const encryptedCountAfterInc = await fheCounterContract.getCount();
    const clearCountAfterInc = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountAfterInc,
      fheCounterContractAddress,
      signers.alice,
    );
    expect(clearCountAfterInc).to.eq(clearCountBeforeInc + clearOne);
  });

  it("decrement the counter by 1", async function () {
    const clearOne = 1;
    const encryptedOne = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(clearOne)
      .encrypt();

    // First increment
    let tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    // Then decrement
    tx = await fheCounterContract.connect(signers.alice).decrement(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    // Check result (decrypt)
    const encryptedCountAfterDec = await fheCounterContract.getCount();
    const clearCountAfterDec = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountAfterDec,
      fheCounterContractAddress,
      signers.alice,
    );

    expect(clearCountAfterDec).to.eq(0);
  });
});
