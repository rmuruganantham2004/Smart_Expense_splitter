import { describe, it, expect } from 'vitest';
import { minimizeCashFlow, MemberBalance } from '../utils/settlement.js';
import { parseExpenseRegexFallback } from '../utils/aiParser.js';

describe('Smart Expense Splitter - Core Algorithms', () => {
  
  describe('Cash Flow Minimization Algorithm', () => {
    it('should settle circular debts with zero transactions', () => {
      const balances: MemberBalance[] = [
        { userId: '1', name: 'Alice', email: 'a@ex.com', balance: 0 },
        { userId: '2', name: 'Bob', email: 'b@ex.com', balance: 0 },
        { userId: '3', name: 'Charlie', email: 'c@ex.com', balance: 0 },
      ];
      
      const transactions = minimizeCashFlow(balances);
      expect(transactions).toHaveLength(0);
    });

    it('should correctly optimize linear debts', () => {
      // Bob owes Alice 100, Charlie owes Bob 100
      // Net: Alice (+100), Bob (0), Charlie (-100)
      // Optimized: Charlie pays Alice 100
      const balances: MemberBalance[] = [
        { userId: '1', name: 'Alice', email: 'a@ex.com', balance: 100 },
        { userId: '2', name: 'Bob', email: 'b@ex.com', balance: 0 },
        { userId: '3', name: 'Charlie', email: 'c@ex.com', balance: -100 },
      ];

      const transactions = minimizeCashFlow(balances);
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toEqual({
        from: { id: '3', name: 'Charlie', email: 'c@ex.com' },
        to: { id: '1', name: 'Alice', email: 'a@ex.com' },
        amount: 100,
      });
    });

    it('should minimize complex transaction graphs', () => {
      // Akash -> Param 200, Rahul -> Param 150, Vijay -> Akash 100
      // Net balances:
      // Param: +350
      // Akash: -200 + 100 = -100
      // Rahul: -150
      // Vijay: -100
      const balances: MemberBalance[] = [
        { userId: '1', name: 'Param', email: 'p@ex.com', balance: 350 },
        { userId: '2', name: 'Akash', email: 'ak@ex.com', balance: -100 },
        { userId: '3', name: 'Rahul', email: 'r@ex.com', balance: -150 },
        { userId: '4', name: 'Vijay', email: 'v@ex.com', balance: -100 },
      ];

      const transactions = minimizeCashFlow(balances);
      expect(transactions).toHaveLength(3);
      
      // Verify all debtors are sending to Param who is the only creditor
      transactions.forEach(t => {
        expect(t.to.id).toBe('1'); // must pay Param
      });

      const totalSetted = transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalSetted).toBe(350);
    });
  });

  describe('Regex NLP Text Parser Fallback', () => {
    it('should parse simple "paid X for Y shared with Z" pattern', () => {
      const text = 'Param paid 1200 for pizza shared with Akash and Rahul';
      const parsed = parseExpenseRegexFallback(text, ['Param', 'Akash', 'Rahul']);

      expect(parsed.payer).toBe('Param');
      expect(parsed.amount).toBe(1200);
      expect(parsed.description).toBe('pizza');
      expect(parsed.participants).toContain('Param');
      expect(parsed.participants).toContain('Akash');
      expect(parsed.participants).toContain('Rahul');
    });

    it('should parse "shared with everyone" resolving with context members', () => {
      const text = 'Rahul paid 900 for movie tickets shared with everyone';
      const parsed = parseExpenseRegexFallback(text, ['Param', 'Akash', 'Rahul', 'Vijay']);

      expect(parsed.payer).toBe('Rahul');
      expect(parsed.amount).toBe(900);
      expect(parsed.description).toBe('movie tickets');
      expect(parsed.participants).toHaveLength(4);
      expect(parsed.participants).toContain('Vijay');
    });

    it('should fail gracefully on bad inputs returning basic description and amounts', () => {
      const text = 'spent 450 bucks on Uber';
      const parsed = parseExpenseRegexFallback(text);
      expect(parsed.amount).toBe(450);
      expect(parsed.description).toBe('spent 450 bucks on Uber');
    });
  });
});
