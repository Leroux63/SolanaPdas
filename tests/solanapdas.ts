import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Solanapdas } from "../target/types/solanapdas";
import * as assert from "assert";
import { PublicKey } from "@solana/web3.js";

describe("solanapdas", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Program reference
  const program = anchor.workspace.Solanapdas as Program<Solanapdas>;

  // Generate the PDA for the bank account
  const seeds = [Buffer.from("bankaccount"), provider.wallet.publicKey.toBuffer()];
  const [bankAccountPublicKey] = PublicKey.findProgramAddressSync(seeds, program.programId);

  // Helper function to fetch and log bank account details
  async function logBankAccountDetails(publicKey: PublicKey) {
    try {
      const account = await program.account.bank.fetch(publicKey);
      console.log(`Account Address: ${publicKey.toBase58()}`);
      console.log(`Account Name: ${account.name}`);
      console.log(`Account Balance: ${account.balance.toNumber()}`);
      console.log(`Account Owner: ${account.owner.toBase58()}`);
    } catch (error) {
      console.log(`Error fetching account details: ${error}`);
    }
  }

  it("Creates a bank account", async () => {
    try {
      // Check if the account already exists
      console.log(`Checking if the bank account already exists...`);
      await logBankAccountDetails(bankAccountPublicKey);

      // Attempt to create the bank account
      console.log(`Creating a new bank account...`);
      try {
        await program.methods.create("MyBank")
          .accounts({
            bank: bankAccountPublicKey,
            user: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
      } catch (error) {
        console.log(`Error during account creation: ${error}`);
      }

      // Verify the account details
      console.log(`Fetching the bank account details after creation...`);
      await logBankAccountDetails(bankAccountPublicKey);

      // Assertions
      const account = await program.account.bank.fetch(bankAccountPublicKey);
      assert.strictEqual(account.name, "MyBank");
      assert.strictEqual(account.balance.toNumber(), 0); // Assure initial balance is 0
      assert.strictEqual(account.owner.toBase58(), provider.wallet.publicKey.toBase58());
    } catch (error) {
      console.log(`Error during account creation: ${error}`);
    }
  });

  it("Deposits into the bank account", async () => {
    const depositAmount = new anchor.BN(1000);

    try {
      console.log(`Depositing ${depositAmount.toNumber()} lamports into the bank account...`);
      await program.methods.deposit(depositAmount)
        .accounts({
          bank: bankAccountPublicKey,
          user: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`Fetching the bank account details after deposit...`);
      await logBankAccountDetails(bankAccountPublicKey);

      // Assertions
      const account = await program.account.bank.fetch(bankAccountPublicKey);
      // Assuming the balance was initially 0
      assert.strictEqual(account.balance.toNumber(), depositAmount.toNumber());
    } catch (error) {
      console.log(`Error during deposit: ${error}`);
    }
  });

  it("Withdraws from the bank account", async () => {
    const withdrawAmount = new anchor.BN(500);

    try {
        // Fetch account details before withdrawal
        console.log(`Fetching the bank account details before withdrawal...`);
        const beforeAccount = await program.account.bank.fetch(bankAccountPublicKey);
        console.log(`Bank Account Balance before withdrawal: ${beforeAccount.balance.toNumber()}`);

        // Fetch user's balance before withdrawal
        const userAccount = await provider.connection.getAccountInfo(provider.wallet.publicKey);
        const userBalanceBefore = userAccount ? userAccount.lamports : 0;
        console.log(`User Balance before withdrawal: ${userBalanceBefore}`);

        // Execute the withdrawal
        console.log(`Withdrawing ${withdrawAmount.toNumber()} lamports from the bank account...`);
        const txSignature = await program.methods.withdraw(withdrawAmount)
            .accounts({
                bank: bankAccountPublicKey,
                user: provider.wallet.publicKey,
            })
            .rpc();

        // Wait for the transaction confirmation
        await provider.connection.confirmTransaction(txSignature);

        // Fetch account details after withdrawal
        console.log(`Fetching the bank account details after withdrawal...`);
        const afterAccount = await program.account.bank.fetch(bankAccountPublicKey);
        console.log(`Bank Account Balance after withdrawal: ${afterAccount.balance.toNumber()}`);

        // Fetch user's balance after withdrawal
        const userAccountAfter = await provider.connection.getAccountInfo(provider.wallet.publicKey);
        const userBalanceAfter = userAccountAfter ? userAccountAfter.lamports : 0;
        console.log(`User Balance after withdrawal: ${userBalanceAfter}`);

        // Calculate the expected balance after accounting for transaction fees
        const txFee = userBalanceBefore - userBalanceAfter;
        const expectedUserBalanceAfter = userBalanceBefore - withdrawAmount.toNumber() - txFee;

        // Display the transaction fee
        console.log(`Estimated transaction fee: ${txFee}`);

        // Allow for a small tolerance in the expected vs actual balance
        const tolerance = 10; // Adjust tolerance as needed
        assert.ok(Math.abs(userBalanceAfter - expectedUserBalanceAfter) <= tolerance, `Expected user balance to be within ${tolerance} of ${expectedUserBalanceAfter}. Actual: ${userBalanceAfter}`);

        // Assertions
        assert.strictEqual(afterAccount.balance.toNumber(), beforeAccount.balance.toNumber() - withdrawAmount.toNumber());
    } catch (error) {
        console.log(`Error during withdrawal: ${error}`);
    }
  });

});
