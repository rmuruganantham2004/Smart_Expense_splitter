export interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  balance: number; // positive = is owed money, negative = owes money
}

export interface OptimizedTransaction {
  from: {
    id: string;
    name: string;
    email: string;
  };
  to: {
    id: string;
    name: string;
    email: string;
  };
  amount: number;
}

/**
 * Greedily resolves debts to minimize the total number of transactions.
 * Time complexity: O(N^2) where N is the number of members.
 */
export function minimizeCashFlow(members: MemberBalance[]): OptimizedTransaction[] {
  // Round balances to 2 decimal places to avoid float issues
  const balances = members.map(m => ({
    ...m,
    balance: Math.round(m.balance * 100) / 100,
  }));

  const transactions: OptimizedTransaction[] = [];

  // Helper to find index of max creditor and max debtor
  const getMinMax = () => {
    let minIdx = 0;
    let maxIdx = 0;

    for (let i = 1; i < balances.length; i++) {
      if (balances[i].balance < balances[minIdx].balance) {
        minIdx = i;
      }
      if (balances[i].balance > balances[maxIdx].balance) {
        maxIdx = i;
      }
    }

    return { minIdx, maxIdx };
  };

  const solve = () => {
    const { minIdx, maxIdx } = getMinMax();

    // If both balances are close to 0, settlement is complete
    if (Math.abs(balances[minIdx].balance) < 0.01 && Math.abs(balances[maxIdx].balance) < 0.01) {
      return;
    }

    const debtor = balances[minIdx];
    const creditor = balances[maxIdx];

    // Find the amount to be settled
    const amountToSettle = Math.min(-debtor.balance, creditor.balance);

    // Record the transaction
    transactions.push({
      from: {
        id: debtor.userId,
        name: debtor.name,
        email: debtor.email,
      },
      to: {
        id: creditor.userId,
        name: creditor.name,
        email: creditor.email,
      },
      amount: Math.round(amountToSettle * 100) / 100,
    });

    // Update balances
    balances[minIdx].balance += amountToSettle;
    balances[maxIdx].balance -= amountToSettle;

    // Recurse
    solve();
  };

  solve();

  return transactions;
}
