## Ticketing Integration

A ticketing provider is configured. During elaboration:
1. Create an epic for this intent (or link to existing one if `epic:` is set in intent.md)
2. For each unit created, create a ticket linked to the epic
3. Store ticket key in unit frontmatter: `ticket: PROJ-123`
4. Map unit `depends_on` to ticket blocked-by relationships
5. Include the H·AI·K·U browse link in ticket descriptions

See ticketing provider instructions for details on content format and status mapping.