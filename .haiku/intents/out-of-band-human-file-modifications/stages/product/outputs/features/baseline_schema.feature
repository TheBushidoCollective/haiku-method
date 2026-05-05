Feature: Baseline persistent state schema
  The Baseline schema records the last-acknowledged content hash and author class for every
  tracked file in an intent. It is the reference against which the drift-detection gate compares
  on-disk state on every tick.

  Background:
    Given an active intent "out-of-band-human-file-modifications"
    And the intent has a stage "design"
    And the stage's tracked surface includes "stages/design/artifacts/" and "knowledge/"

  # --- Required fields ---

  Scenario: Baseline entry contains all required fields after agent writes a file
    Given the agent writes "stages/design/artifacts/hero-layout.html" via its MCP tool pipeline
    When the workflow engine updates the baseline for that file
    Then the baseline entry for "stages/design/artifacts/hero-layout.html" contains:
      | field            | type    | present |
      | path             | string  | yes     |
      | sha256           | string  | yes     |
      | bytes            | integer | yes     |
      | mtime_ns         | integer | yes     |
      | is_binary        | boolean | yes     |
      | author_class     | enum    | yes     |
      | acknowledged_at  | RFC3339 | yes     |
      | acknowledged_via | enum    | yes     |
      | stage            | string  | yes     |
      | tracking_class   | enum    | yes     |

  Scenario: Baseline entry has valid sha256 format
    Given a baseline entry exists for "knowledge/brand-guide.md"
    When the sha256 field is read
    Then it is exactly 64 lowercase hexadecimal characters

  Scenario: Baseline entry path is intent-relative with no leading slash
    Given the agent writes a file at the absolute path inside the intent directory
    When the baseline entry is written
    Then the "path" field is relative to the intent root
    And the "path" field does not start with "/"
    And the "path" field contains no ".." segments

  # --- author_class enum enforcement ---

  Scenario Outline: author_class is limited to the three canonical values
    Given a baseline entry is written for a file
    When "author_class" is set to "<value>"
    Then the entry is accepted and persisted
    Examples:
      | value           |
      | agent           |
      | human-via-mcp   |
      | human-implicit  |

  Scenario: author_class rejects deprecated aliases
    Given a baseline entry write is attempted
    When "author_class" is set to "<alias>"
    Then the write is rejected with a schema validation error
    Examples:
      | alias    |
      | user     |
      | external |
      | manual   |

  # --- acknowledged_via enum enforcement ---

  Scenario Outline: acknowledged_via carries the correct channel for each write path
    Given a file is written through "<channel>"
    When the baseline entry is written for that file
    Then "acknowledged_via" equals "<expected_value>"
    Examples:
      | channel                              | expected_value          |
      | agent MCP tool pipeline              | agent-write             |
      | haiku_human_write MCP tool           | human-write-tool        |
      | SPA upload endpoint                  | spa-upload              |
      | haiku_classify_drift terminal outcome| classification-terminal |
      | haiku_baseline_init bootstrap        | baseline-init           |

  # --- tracking_class enum enforcement ---

  Scenario Outline: tracking_class matches the file's directory location
    Given a baseline entry is created for a file at "<path>"
    Then "tracking_class" equals "<expected>"
    Examples:
      | path                                        | expected      |
      | stages/design/artifacts/hero.html           | stage-output  |
      | stages/design/knowledge/DESIGN-TOKENS.md    | knowledge     |
      | stages/design/units/unit-01/output.md       | unit-output   |
      | intent.md                                   | intent-meta   |

  # --- outputs/ alias maps to artifacts/ ---

  Scenario: A path referencing outputs/ is stored as artifacts/ in the baseline key
    Given the intent has a stage with an "outputs/" directory reference in a prior document
    When the baseline is read
    Then the baseline key uses "artifacts/" not "outputs/"
    And no separate "outputs/" baseline entry exists

  # --- Cross-stage entries ---

  Scenario: A design artifact modified during the development stage is stored in the design baseline
    Given the intent has completed stage "design" and is now in stage "development"
    And the file "stages/design/artifacts/hero-layout.html" has been modified on disk
    When the drift-detection gate runs during the development stage tick
    Then the drift event carries "stage" = "design"
    And the baseline entry is stored in the design stage's baseline.json, not the development stage's
