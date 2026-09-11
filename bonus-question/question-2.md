# Qn-2 — Previous and next designation for every row

**Approach:** so the appraoch would be to look one row back and one row ahead inside the same employee's own history.
as the question also mentions, the first row of an employee has nothing before it and the last row has nothing after it, so those return `NULL`.

**Using the Window Function along with partitioning.**

## Query

```sql
SELECT emp_id, effective_date,
    LAG(designation) OVER (
        PARTITION BY emp_id
        ORDER BY effective_date ASC, txn_id ASC
    ) AS previous_designation,
    designation,
    LEAD(designation) OVER (
        PARTITION BY emp_id
        ORDER BY effective_date ASC, txn_id ASC
    ) AS next_designation
FROM emp_designation_log
ORDER BY emp_id, effective_date ASC, txn_id ASC;
```

## Reasoning Thought

As the question mentions, for every row we have to show the designation that came just before it and just after it for the same employee. One alternative is to join the table to itself twice, once looking backward and once looking forward, but that gets messy and needs the same date handling written twice. The window functions do both in a single pass over the rows. partitioning by `emp_id` so that one employee's timeline never leaks into another employee's, and this time the ordering is **`effective_date` ascending, not descending like qn-1**, because `LAG` has to look back in time and `LEAD` has to look forward, so the rows must sit in chronological order first. `txn_id` is again used as the tie-break so that two rows sharing the same `effective_date` still keep a fixed order and the previous/next values do not flip around. `LAG(designation)` then picks the designation one row behind and `LEAD(designation)` picks the one row ahead, and since the first row of an employee has nothing before it and the last row has nothing after it, those two return `NULL` on their own, which is exactly what the question asks for.

### Step 1 — Partition per employee and put the rows in chronological order

Read the whole rows and partition them by `emp_id` such that each employee's timeline is independent.
For each partition, order by `effective_date ASC` then `txn_id ASC` so the rows sit in chronological order.
For example `EMP005` is stored out of order in the table, her **2024-03-01** row sits after her **2024-06-15** row, so ordering has to fix that first.

**"EMP005 as stored in the table"**

| emp_id | designation | effective_date | txn_id |
|---|---|---|---|
| EMP005 | Senior Developer | 2024-06-15 | T012 |
| EMP005 | Mid Developer | 2024-03-01 | T013 |
| EMP005 | Senior Developer | 2024-11-20 | T014 |

**"EMP005 after ordering inside the partition"**

| emp_id | designation | effective_date | txn_id |
|---|---|---|---|
| EMP005 | Mid Developer | 2024-03-01 | T013 |
| EMP005 | Senior Developer | 2024-06-15 | T012 |
| EMP005 | Senior Developer | 2024-11-20 | T014 |

> **Note:** the ordering here is ascending, opposite of qn-1, because `LAG` has to look back in time and `LEAD` has to look forward.

### Step 2 — LAG reads one row behind and LEAD reads one row ahead

`LAG` reads the designation one row behind and `LEAD` reads the one row ahead inside the same partition.

```sql
LAG(designation)  OVER (PARTITION BY emp_id ORDER BY effective_date ASC, txn_id ASC) AS previous_designation,
LEAD(designation) OVER (PARTITION BY emp_id ORDER BY effective_date ASC, txn_id ASC) AS next_designation
```

**"EMP005 Partition"**

| emp_id | effective_date | previous_designation | designation | next_designation |
|---|---|---|---|---|
| EMP005 | 2024-03-01 | NULL | Mid Developer | Senior Developer |
| EMP005 | 2024-06-15 | Mid Developer | Senior Developer | Senior Developer |
| EMP005 | 2024-11-20 | Senior Developer | Senior Developer | NULL |

### Step 3 — The boundary rows return NULL on their own

The first row of each partition returns `NULL` for previous and the last row returns `NULL` for next, which is exactly what the question asks for.
Finally, order the final output by `emp_id` first so each employee's timeline reads together.

**"EMP008 Partition"** — both rows share the same date, so `txn_id` decides which one is before the other

| emp_id | effective_date | previous_designation | designation | next_designation |
|---|---|---|---|---|
| EMP008 | 2024-06-01 | NULL | Associate Developer | Mid Developer |
| EMP008 | 2024-06-01 | Associate Developer | Mid Developer | NULL |

> **Note:** if has same date then it gets order based on `txn_id`, otherwise the previous/next values could flip around between runs.

## Final Output against the given sample data

| emp_id | effective_date | previous_designation | designation | next_designation |
|---|---|---|---|---|
| EMP001 | 2024-02-01 | NULL | Associate Developer | Mid Developer |
| EMP001 | 2024-02-05 | Associate Developer | Mid Developer | Senior Developer |
| EMP001 | 2024-02-10 | Mid Developer | Senior Developer | NULL |
| EMP002 | 2024-05-02 | NULL | Mid Developer | Senior Developer |
| EMP002 | 2024-07-15 | Mid Developer | Senior Developer | Mid Developer |
| EMP002 | 2024-09-20 | Senior Developer | Mid Developer | NULL |
| EMP003 | 2024-08-06 | NULL | Mid Developer | Mid Developer |
| EMP003 | 2024-08-06 | Mid Developer | Mid Developer | NULL |
| EMP004 | 2024-01-10 | NULL | Associate Developer | Associate Developer |
| EMP004 | 2024-04-10 | Associate Developer | Associate Developer | Mid Developer |
| EMP004 | 2024-09-10 | Associate Developer | Mid Developer | NULL |
| EMP005 | 2024-03-01 | NULL | Mid Developer | Senior Developer |
| EMP005 | 2024-06-15 | Mid Developer | Senior Developer | Senior Developer |
| EMP005 | 2024-11-20 | Senior Developer | Senior Developer | NULL |
| EMP006 | 2024-01-01 | NULL | Associate Developer | Mid Developer |
| EMP006 | 2024-05-10 | Associate Developer | Mid Developer | Mid Developer |
| EMP006 | 2024-05-10 | Mid Developer | Mid Developer | NULL |
| EMP007 | 2023-03-03 | NULL | Senior Developer | Resigned |
| EMP007 | 2023-06-30 | Senior Developer | Resigned | Associate Developer |
| EMP007 | 2024-01-15 | Resigned | Associate Developer | Mid Developer |
| EMP007 | 2024-07-15 | Associate Developer | Mid Developer | NULL |
| EMP008 | 2024-06-01 | NULL | Associate Developer | Mid Developer |
| EMP008 | 2024-06-01 | Associate Developer | Mid Developer | NULL |
| EMP009 | 2024-09-01 | NULL | Senior Developer | NULL |


