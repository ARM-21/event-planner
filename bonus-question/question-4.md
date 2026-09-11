# Qn-4 — Designation held at the time of each project allocation

**Approach:** so the appraoch would be to find the most recent date in past of an employee from particular project location date.
as the question also mentions, what if the designation is not yet decided before project allocation date.

**Using a Common Table Expression, a LEFT JOIN on a date condition, and a Window Function with partitioning.**

## Query

```sql
WITH ranked_allocations AS (
    SELECT
        a.allocation_id,
        a.emp_id,
        d.emp_name,
        a.project_name,
        a.allocated_role,
        a.allocation_start,
        d.designation AS designation_at_allocation,
        ROW_NUMBER() OVER (
            PARTITION BY a.allocation_id
            ORDER BY d.effective_date DESC, d.txn_id DESC
        ) AS rn
    FROM emp_allocation_log a
    LEFT JOIN emp_designation_log d
      ON d.emp_id = a.emp_id
     AND d.effective_date <= a.allocation_start
)
SELECT
    allocation_id,
    emp_id,
    emp_name,
    project_name,
    allocated_role,
    allocation_start,
    designation_at_allocation
FROM ranked_allocations
WHERE rn = 1;
```

## Reasoning Thought

### Step 1 — Extract every designation that was already in effect

Extract all the possible result which contains all the past designation from current project allocation date of a employee for a single employee id.
For example `"Project Alpha"` starts at **2024-02-03**, before this date all the possible are extracted.

| allocation_id | emp_id | project_name | designation | effective_date |
|---|---|---|---|---|
| A001 | emp001 | Project Alpha | associate developer | 2024-01-01 |
| A001 | emp001 | Project Alpha | junior developer | 2024-01-15 |
| A001 | emp001 | Project Alpha | Mid developer | 2024-02-01 |
| A002 | emp001 | Project Beta | Mid developer | 2024-02-01 |
| A002 | emp001 | Project Beta | Senior developer | 2024-02-10 |

I am using **left join** such that expected result is extracted:-

```sql
FROM emp_allocation_log a
LEFT JOIN emp_designation_log d
  ON d.emp_id = a.emp_id
 AND d.effective_date <= a.allocation_start
```

> **Note:** In this current query, all the employee with no designation are reserved with `Null` reporting as there is no effective date for that employee.

### Step 2 — Rank each allocation's history, most recent first

Now, we need to group the each project allocation eg(`a001`, `a002`..) and for each with entire past allocation history for that specific project with
most recent first or in descending order along ranking to retreive the most recent with row number.

**"Project Alpha Partition"**

| rn | allocation_id | emp_id | project_name | designation | effective_date |
|---|---|---|---|---|---|
| 1 | A001 | emp001 | Project Alpha | Mid developer | 2024-02-01 |
| 2 | A001 | emp001 | Project Alpha | junior developer | 2024-01-15 |
| 3 | A001 | emp001 | Project Alpha | associate developer | 2024-01-01 |

**"Project Beta Partition"**

| rn | allocation_id | emp_id | project_name | designation | effective_date |
|---|---|---|---|---|---|
| 1 | A002 | emp001 | Project Beta | Senior developer | 2024-02-10 |
| 2 | A002 | emp001 | Project Beta | Mid developer | 2024-02-01 |

To acheive that we need:-

```sql
ROW_NUMBER() OVER (
    PARTITION BY a.allocation_id
    ORDER BY d.effective_date DESC, d.txn_id DESC
) AS rn
```

> **Note:** if has same date then it gets order based on `txn_id`.

### Step 3 — Keep only the top row of each allocation

Finally, we need the final 1 row for each project such that we only that the designation for individual project.

**"Project Alpha Partition"**

| rn | allocation_id | emp_id | project_name | designation | effective_date |
|---|---|---|---|---|---|
| 1 | A001 | emp001 | Project Alpha | Mid developer | 2024-02-01 |

**"Project Beta Partition"**

| rn | allocation_id | emp_id | project_name | designation | effective_date |
|---|---|---|---|---|---|
| 1 | A002 | emp001 | Project Beta | Senior developer | 2024-02-10 |

## Final Output against the given sample data

| allocation_id | emp_id | emp_name | project_name | allocated_role | allocation_start | designation_at_allocation |
|---|---|---|---|---|---|---|
| A001 | EMP001 | Alice Johnson | Project Alpha | Developer | 2024-02-03 | Associate Developer |
| A002 | EMP001 | Alice Johnson | Project Beta | Tech Lead | 2024-05-01 | Senior Developer |
| A003 | EMP002 | Bob Martinez | Project Alpha | Developer | 2024-05-10 | Mid Developer |
| A004 | EMP002 | Bob Martinez | Project Gamma | Senior Contributor | 2024-09-01 | Senior Developer |
| A005 | EMP003 | Carol Smith | Project Beta | Developer | 2024-08-06 | Mid Developer |
| A006 | EMP004 | David Lee | Project Delta | Developer | 2024-02-01 | Associate Developer |
| A007 | EMP005 | Eva Chen | Project Alpha | Senior Contributor | 2024-04-01 | Mid Developer |
| A008 | EMP005 | Eva Chen | Project Gamma | Tech Lead | 2024-08-01 | Senior Developer |
| A009 | EMP006 | Frank Patel | Project Delta | Developer | 2024-03-01 | Associate Developer |
| A010 | EMP007 | Grace Kim | Project Beta | Developer | 2024-02-01 | Associate Developer |
| A011 | EMP008 | Henry Walsh | Project Alpha | Developer | 2024-07-01 | Mid Developer |
| A012 | EMP009 | Irene Novak | Project Gamma | Senior Contributor | 2024-10-01 | Senior Developer |

