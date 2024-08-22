use anchor_lang::prelude::*;

declare_id!("C7TxEfdd9bZQPvKhV2nmbirHqgFMn2Wn8fEcejrLpyJt");

#[program]
pub mod solanapdas {
    use super::*;

    pub fn create(ctx: Context<Create>, name: String) -> Result<()> {
        let bank = &mut ctx.accounts.bank;
        if bank.name.len() > 0 {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }
        bank.name = name;
        bank.balance = 0;
        bank.owner = *ctx.accounts.user.key;
        Ok(())
    }
    

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let txn = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.bank.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &txn,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.bank.to_account_info(),
            ],
        )?;
        // Met à jour le solde dans la structure de données du compte bancaire
        let bank = &mut ctx.accounts.bank;
        bank.balance += amount;
        Ok(())
    }
    

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let bank = &mut ctx.accounts.bank;
        let user = &ctx.accounts.user;
        
        // Vérifier que l'utilisateur est le propriétaire du compte bancaire
        if bank.owner != *user.key {
            return Err(ProgramError::IncorrectProgramId.into());
        }
        
        // Vérifier si le compte bancaire a suffisamment de fonds
        let rent = Rent::get()?.minimum_balance(bank.to_account_info().data_len());
        let bank_balance = **bank.to_account_info().lamports.borrow();
        if bank_balance - rent < amount {
            return Err(ProgramError::InsufficientFunds.into());
        }
        
        // Effectuer le retrait
        **bank.to_account_info().try_borrow_mut_lamports()? -= amount;
        **user.to_account_info().try_borrow_mut_lamports()? += amount;
        
        // Met à jour le solde dans la structure de données du compte bancaire
        bank.balance -= amount;
    
        Ok(())
    }
    
    
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(init, payer=user, space=5000, seeds=[b"bankaccount", user.key().as_ref()], bump)]
    pub bank: Account<'info, Bank>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Bank {
    pub name: String,
    pub balance: u64,
    pub owner: Pubkey,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub bank: Account<'info, Bank>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub bank: Account<'info, Bank>,
    #[account(mut)]
    pub user: Signer<'info>,
}
