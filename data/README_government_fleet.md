# Government Public Transport Fleet Reference

File: `government_stu_fleet_reference.csv`

This CSV contains the 12 state transport undertaking (STU) fleet-count entries previously selected for the SmartRoute AI project.

## Source and limitations

- Source: Busworld Foundation presentation, **“Evolving an Electric Bus Ecosystem in Indian Cities”** (December 2022).
- Source table: **“STU-wise Fleet”**.
- Source PDF: https://www.busworldindia.org/sites/india/files/2022-12/Evolving%20an%20Electric%20Bus%20Ecosystem%20in%20Indian%20Cities.pdf
- The presentation's fleet table does not state a precise reference date for the counts. The CSV therefore records the count reference date as **Not specified in source table**.
- These are historical reference figures, not verified current fleet sizes.
- This file is **not an extract of the Government of India's OGD/ data.gov.in catalog**. The GOI catalog previously discussed provides state/UT-level public-sector fleet totals and does not provide individual bus registration numbers.
- The figures are organization-level totals. They must not be treated as individual bus records, available buses, route allocations, or live fleet inventory.
- No registration numbers or individual bus names are included because the source does not provide them.

## Intended use in SmartRoute AI

Use these values only as contextual reference data for fleet-size comparisons or demonstration charts. Do not use them to assign a physical bus to a passenger request or claim that a particular bus is currently operating. For operational planning, replace or supplement them with dated, verified data obtained directly from the relevant transport undertaking.

## CSV columns

- `state`: State associated with the transport undertaking.
- `transport_operator`: Operator name or normalized source abbreviation.
- `reported_bus_fleet_count`: Count shown in the source table.
- `source_type`: Description of the source table.
- `source_publication_date`: Publication month of the presentation.
- `count_reference_date`: Reference date stated by the source (not specified).
- `notes`: Interpretation and limitations.
