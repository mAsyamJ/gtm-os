1. Start with an inspectable constraint.

2. No reads or writes occur except within a transaction.

3. END TRANSACTION is an alias for COMMIT.

4. Transactions created using BEGIN...COMMIT do not nest.

5. For nested transactions, use the SAVEPOINT and RELEASE commands.

6. Source-supported engineering note. Personal experience is included only when owner-attested.
