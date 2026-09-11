# Qn-1 — Current designation of every employee

**Approach:** we have to find the most recent designation of an employee based on the latest `effective_date` from the history.
as the question also mentions, the same employee can have many rows over time so only the newest one of them is the current designation.

**Using Common Table Expression Along with Window Function and Partitioning.**

## Query

```sql
WITH ranked_logs AS (
    SELECT emp_id, designation, emp_name,
        ROW_NUMBER() OVER (
            PARTITION BY emp_id
            ORDER BY effective_date DESC, txn_id DESC
        ) AS n
    FROM emp_designation_log
)
SELECT emp_id, emp_name, designation AS current_designation
FROM ranked_logs
WHERE n = 1;
```

## Reasoning Thought

Although there might be the alternative ways to achieve same result. The most effective one i used is common table expression along with window function and partitioning. As the question mentions, we have to find the most recent designation based on the latest `effective_date` from the history(`emp_designation_log`). partitioning the history of same employee while using **`effective_date` in descending order** such that the most recent even with same date ties is ranked 1 2 3 and so on along with `txn_id` (it is used to make sure the same date occurence doesn't effect the result and ranking). Finally, select the rows which only has **row number 1** as for th each employee the numbering resets for each partition.

### Step 1 — Read the whole history and partition it per employee

Read the whole rows and partition them by `emp_id` such that they are ranked independently.
For example taking `EMP001` and `EMP008` out of the history, each of them becomes its own separate group.

| emp_id | emp_name | designation | effective_date | txn_id |
|---|---|---|---|---|
| EMP001 | Alice Johnson | Associate Developer | 2024-02-01 | T001 |
| EMP001 | Alice Johnson | Mid Developer | 2024-02-05 | T002 |
| EMP001 | Alice Johnson | Senior Developer | 2024-02-10 | T003 |
| EMP008 | Henry Walsh | Associate Developer | 2024-06-01 | T022 |
| EMP008 | Henry Walsh | Mid Developer | 2024-06-01 | T023 |

### Step 2 — Order each partition with the most recent first and assign the row number

For each partition, order by `effective_date DESC` then `txn_id DESC` for ranking using both columns.
Assigns row number for each group and it resets for different partition.

```sql
ROW_NUMBER() OVER (
    PARTITION BY emp_id
    ORDER BY effective_date DESC, txn_id DESC
) AS n
```

**"EMP001 Partition"**

| n | emp_id | emp_name | designation | effective_date | txn_id |
|---|---|---|---|---|---|
| 1 | EMP001 | Alice Johnson | Senior Developer | 2024-02-10 | T003 |
| 2 | EMP001 | Alice Johnson | Mid Developer | 2024-02-05 | T002 |
| 3 | EMP001 | Alice Johnson | Associate Developer | 2024-02-01 | T001 |

**"EMP008 Partition"**

| n | emp_id | emp_name | designation | effective_date | txn_id |
|---|---|---|---|---|---|
| 1 | EMP008 | Henry Walsh | Mid Developer | 2024-06-01 | T023 |
| 2 | EMP008 | Henry Walsh | Associate Developer | 2024-06-01 | T022 |

> **Note:** if has same date then it gets order based on `txn_id`, which is what decides `T023` over `T022` for `EMP008`.

### Step 3 — Extract the row whose n = 1

Finally, select the rows which only has row number 1, as for each employee the numbering resets for each partition.

**"EMP001 Partition"**

| n | emp_id | emp_name | current_designation |
|---|---|---|---|
| 1 | EMP001 | Alice Johnson | Senior Developer |

**"EMP008 Partition"**

| n | emp_id | emp_name | current_designation |
|---|---|---|---|
| 1 | EMP008 | Henry Walsh | Mid Developer |

## Final Output against the given sample data

| emp_id | emp_name | current_designation |
|---|---|---|
| EMP001 | Alice Johnson | Senior Developer |
| EMP002 | Bob Martinez | Mid Developer |
| EMP003 | Carol Smith | Mid Developer |
| EMP004 | David Lee | Mid Developer |
| EMP005 | Eva Chen | Senior Developer |
| EMP006 | Frank Patel | Mid Developer |
| EMP007 | Grace Kim | Mid Developer |
| EMP008 | Henry Walsh | Mid Developer |
| EMP009 | Irene Novak | Senior Developer |

