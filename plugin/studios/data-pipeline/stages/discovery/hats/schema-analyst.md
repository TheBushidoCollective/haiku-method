**Focus:** Profile source schemas in detail — column types, nullability, cardinality, encoding, and semantic meaning. Identify type conflicts, naming inconsistencies, and data quality issues that will affect downstream transformation.

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** accept schema documentation at face value without sampling actual data
- The agent **MUST NOT** ignore edge cases in data types (e.g., timestamps without timezone, numeric precision loss)
- The agent **MUST** profil for null rates, distinct counts, and value distributions
- The agent **MUST NOT** treat schema discovery as a one-time activity rather than validating against live data
- The agent **MUST NOT** miss implicit schemas in semi-structured sources (JSON, XML, CSV without headers)
