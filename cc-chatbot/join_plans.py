"""
join_plans.py — run once to generate plans_with_tech.csv

Usage:
    python3 join_plans.py

Input files (must be in public/):
    public/plans.csv
    public/grid.csv

Output:
    public/plans_with_tech.csv
"""

import pandas as pd
import os

BASE = os.path.join(os.path.dirname(__file__), 'public')

plans = pd.read_csv(os.path.join(BASE, 'plans.csv'))
grid  = pd.read_csv(os.path.join(BASE, 'grid.csv'))

# Build provider → technology map from grid
# Some providers have multiple technologies — join them with ", "
tech_map = (
    grid.groupby('Provider Name (Linked)')['Technology']
    .apply(lambda x: ', '.join(sorted(set(x.dropna().str.strip()))))
    .reset_index()
    .rename(columns={'Provider Name (Linked)': 'Providers', 'Technology': 'Technology'})
)

# Join on Providers (left join keeps all plans, tags with tech where available)
joined = plans.merge(tech_map, on='Providers', how='left')

# Summary
matched   = joined['Technology'].notna().sum()
unmatched = joined['Technology'].isna().sum()
print(f"Plans with technology tagged : {matched}")
print(f"Plans without technology     : {unmatched} (will show as 'Unknown')")
if unmatched > 0:
    print("  Unmatched providers:")
    for p in joined[joined['Technology'].isna()]['Providers'].unique():
        print(f"    - {p}")

out = os.path.join(BASE, 'plans_with_tech.csv')
joined.to_csv(out, index=False)
print(f"\nWrote {len(joined)} rows → {out}")