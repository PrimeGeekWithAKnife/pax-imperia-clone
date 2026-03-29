# Population Analyst -- Lessons Learnt

## Current State
- PlanetDemographics includes: age distribution (young, working age, elderly), eight vocations (scientists, workers, military, merchants, administrators, educators, medical, general), faith distribution (fanatics through secular), loyalty distribution (loyal through rebellious), education level, health level, multi-species cohabitation with per-species loyalty
- Demographics engine processes modifiers per tick (growth rate, health, education, happiness, government type, building availability)
- Most sophisticated population system of any space 4X in development
- Missing: wealth distribution, employment rate, crime, healthcare/disease, tourism, refugees, age-based mortality, and the UI to visualise it all

## Key Insight
- The data structures already exist -- the key missing piece is making demographics VISIBLE to the player and CONSEQUENTIAL to gameplay
- A planet with 40% unemployment should feel different from one at full employment

## Director Decisions (29 March 2026)
- Wealth tracked per population group, not individuals
- Inequality creates escalating probability of crisis (1%, 2%, 3%...) not hard thresholds
- Wealthy elites wield disproportionate political influence; inequality begets inequality
- Jobs are vocation-specific: engineers, scientists, soldiers, labourers, doctors, traders
- Migration driven by employment + wealth + access + attitude toward foreigners + player policy
- Automation is transformative and POSITIVE: improves capabilities, inequality, lifespan, happiness, combat
- Diseases are species-specific with rare cross-jumps; nanite/engineered diseases affect everything
- Healthcare on a spectrum: free → semi-subsidised → expensive → non-existent (Maslow lever)
- Biological, chemical, nuclear as distinct WMD categories with different characteristics
- Organised crime as active power player with territory, income, agendas
- State can cooperate with crime through intelligence networks (CIA/Al-Qaeda model)
- Law enforcement corruptible -- more resistant but not immune
- Full working demographic simulation: aging, death, employment, inflation effects on wealth
- Demographic goals set through policy (incentives, tax breaks, education focus) not direct assignment
- Trend projection: show player where things are heading at current pace
- Integration is a spectrum with formal milestones: recognition → protected minority → naturalisation
- Hybrid cultures emerge from long-term cohabitation; some species resist blending
- Per-planet species rights allowed -- creates internal contradictions exploitable by rivals
