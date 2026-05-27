/**
 * @generated SignedSource<<5b51522ccf615122269a65df0144d9c5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type operationsGetIntentQuery$variables = {
  intentExpr: string;
  intentTreeExpr: string;
  knowledgeExpr: string;
  name: string;
  operationsExpr: string;
  owner: string;
  reflectionExpr: string;
  stagesExpr: string;
};
export type operationsGetIntentQuery$data = {
  readonly repository: {
    readonly intentFile: {
      readonly text?: string | null | undefined;
    } | null | undefined;
    readonly intentTree: {
      readonly entries?: ReadonlyArray<{
        readonly name: string;
        readonly object: {
          readonly entries?: ReadonlyArray<{
            readonly name: string;
            readonly type: string;
          }> | null | undefined;
        } | null | undefined;
        readonly type: string;
      }> | null | undefined;
    } | null | undefined;
    readonly knowledgeTree: {
      readonly entries?: ReadonlyArray<{
        readonly name: string;
        readonly object: {
          readonly text?: string | null | undefined;
        } | null | undefined;
        readonly type: string;
      }> | null | undefined;
    } | null | undefined;
    readonly operationsTree: {
      readonly entries?: ReadonlyArray<{
        readonly name: string;
        readonly object: {
          readonly text?: string | null | undefined;
        } | null | undefined;
        readonly type: string;
      }> | null | undefined;
    } | null | undefined;
    readonly reflectionFile: {
      readonly text?: string | null | undefined;
    } | null | undefined;
    readonly stagesTree: {
      readonly entries?: ReadonlyArray<{
        readonly name: string;
        readonly object: {
          readonly entries?: ReadonlyArray<{
            readonly name: string;
            readonly object: {
              readonly entries?: ReadonlyArray<{
                readonly name: string;
                readonly object: {
                  readonly text?: string | null | undefined;
                } | null | undefined;
                readonly type: string;
              }> | null | undefined;
              readonly text?: string | null | undefined;
            } | null | undefined;
            readonly type: string;
          }> | null | undefined;
        } | null | undefined;
        readonly type: string;
      }> | null | undefined;
    } | null | undefined;
  } | null | undefined;
};
export type operationsGetIntentQuery = {
  response: operationsGetIntentQuery$data;
  variables: operationsGetIntentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "intentExpr"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "intentTreeExpr"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "knowledgeExpr"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "operationsExpr"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "owner"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "reflectionExpr"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "stagesExpr"
},
v8 = [
  {
    "kind": "Variable",
    "name": "name",
    "variableName": "name"
  },
  {
    "kind": "Variable",
    "name": "owner",
    "variableName": "owner"
  }
],
v9 = [
  {
    "kind": "Variable",
    "name": "expression",
    "variableName": "intentExpr"
  }
],
v10 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "text",
      "storageKey": null
    }
  ],
  "type": "Blob",
  "abstractKey": null
},
v11 = [
  (v10/*: any*/)
],
v12 = [
  {
    "kind": "Variable",
    "name": "expression",
    "variableName": "intentTreeExpr"
  }
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "type",
  "storageKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TreeEntry",
      "kind": "LinkedField",
      "name": "entries",
      "plural": true,
      "selections": [
        (v13/*: any*/),
        (v14/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Tree",
  "abstractKey": null
},
v16 = [
  {
    "kind": "Variable",
    "name": "expression",
    "variableName": "stagesExpr"
  }
],
v17 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TreeEntry",
      "kind": "LinkedField",
      "name": "entries",
      "plural": true,
      "selections": [
        (v13/*: any*/),
        (v14/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "object",
          "plural": false,
          "selections": (v11/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Tree",
  "abstractKey": null
},
v18 = [
  {
    "kind": "Variable",
    "name": "expression",
    "variableName": "knowledgeExpr"
  }
],
v19 = [
  (v17/*: any*/)
],
v20 = [
  {
    "kind": "Variable",
    "name": "expression",
    "variableName": "operationsExpr"
  }
],
v21 = [
  {
    "kind": "Variable",
    "name": "expression",
    "variableName": "reflectionExpr"
  }
],
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v24 = [
  (v22/*: any*/),
  (v10/*: any*/),
  (v23/*: any*/)
],
v25 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TreeEntry",
      "kind": "LinkedField",
      "name": "entries",
      "plural": true,
      "selections": [
        (v13/*: any*/),
        (v14/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "object",
          "plural": false,
          "selections": (v24/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Tree",
  "abstractKey": null
},
v26 = [
  (v22/*: any*/),
  (v25/*: any*/),
  (v23/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "operationsGetIntentQuery",
    "selections": [
      {
        "alias": null,
        "args": (v8/*: any*/),
        "concreteType": "Repository",
        "kind": "LinkedField",
        "name": "repository",
        "plural": false,
        "selections": [
          {
            "alias": "intentFile",
            "args": (v9/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v11/*: any*/),
            "storageKey": null
          },
          {
            "alias": "intentTree",
            "args": (v12/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TreeEntry",
                    "kind": "LinkedField",
                    "name": "entries",
                    "plural": true,
                    "selections": [
                      (v13/*: any*/),
                      (v14/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "object",
                        "plural": false,
                        "selections": [
                          (v15/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "type": "Tree",
                "abstractKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": "stagesTree",
            "args": (v16/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TreeEntry",
                    "kind": "LinkedField",
                    "name": "entries",
                    "plural": true,
                    "selections": [
                      (v13/*: any*/),
                      (v14/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "object",
                        "plural": false,
                        "selections": [
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "TreeEntry",
                                "kind": "LinkedField",
                                "name": "entries",
                                "plural": true,
                                "selections": [
                                  (v13/*: any*/),
                                  (v14/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "object",
                                    "plural": false,
                                    "selections": [
                                      (v10/*: any*/),
                                      (v17/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "Tree",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "type": "Tree",
                "abstractKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": "knowledgeTree",
            "args": (v18/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v19/*: any*/),
            "storageKey": null
          },
          {
            "alias": "operationsTree",
            "args": (v20/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v19/*: any*/),
            "storageKey": null
          },
          {
            "alias": "reflectionFile",
            "args": (v21/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v11/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v5/*: any*/),
      (v3/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/),
      (v7/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v6/*: any*/)
    ],
    "kind": "Operation",
    "name": "operationsGetIntentQuery",
    "selections": [
      {
        "alias": null,
        "args": (v8/*: any*/),
        "concreteType": "Repository",
        "kind": "LinkedField",
        "name": "repository",
        "plural": false,
        "selections": [
          {
            "alias": "intentFile",
            "args": (v9/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v24/*: any*/),
            "storageKey": null
          },
          {
            "alias": "intentTree",
            "args": (v12/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": [
              (v22/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TreeEntry",
                    "kind": "LinkedField",
                    "name": "entries",
                    "plural": true,
                    "selections": [
                      (v13/*: any*/),
                      (v14/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "object",
                        "plural": false,
                        "selections": [
                          (v22/*: any*/),
                          (v15/*: any*/),
                          (v23/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "type": "Tree",
                "abstractKey": null
              },
              (v23/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": "stagesTree",
            "args": (v16/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": [
              (v22/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "TreeEntry",
                    "kind": "LinkedField",
                    "name": "entries",
                    "plural": true,
                    "selections": [
                      (v13/*: any*/),
                      (v14/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "object",
                        "plural": false,
                        "selections": [
                          (v22/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "TreeEntry",
                                "kind": "LinkedField",
                                "name": "entries",
                                "plural": true,
                                "selections": [
                                  (v13/*: any*/),
                                  (v14/*: any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": null,
                                    "kind": "LinkedField",
                                    "name": "object",
                                    "plural": false,
                                    "selections": [
                                      (v22/*: any*/),
                                      (v10/*: any*/),
                                      (v25/*: any*/),
                                      (v23/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "Tree",
                            "abstractKey": null
                          },
                          (v23/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "type": "Tree",
                "abstractKey": null
              },
              (v23/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": "knowledgeTree",
            "args": (v18/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v26/*: any*/),
            "storageKey": null
          },
          {
            "alias": "operationsTree",
            "args": (v20/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v26/*: any*/),
            "storageKey": null
          },
          {
            "alias": "reflectionFile",
            "args": (v21/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "object",
            "plural": false,
            "selections": (v24/*: any*/),
            "storageKey": null
          },
          (v23/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "880861ad74412df68be2d95e8b286e75",
    "id": null,
    "metadata": {},
    "name": "operationsGetIntentQuery",
    "operationKind": "query",
    "text": "query operationsGetIntentQuery(\n  $owner: String!\n  $name: String!\n  $intentExpr: String!\n  $intentTreeExpr: String!\n  $stagesExpr: String!\n  $knowledgeExpr: String!\n  $operationsExpr: String!\n  $reflectionExpr: String!\n) {\n  repository(owner: $owner, name: $name) {\n    intentFile: object(expression: $intentExpr) {\n      __typename\n      ... on Blob {\n        text\n      }\n      id\n    }\n    intentTree: object(expression: $intentTreeExpr) {\n      __typename\n      ... on Tree {\n        entries {\n          name\n          type\n          object {\n            __typename\n            ... on Tree {\n              entries {\n                name\n                type\n              }\n            }\n            id\n          }\n        }\n      }\n      id\n    }\n    stagesTree: object(expression: $stagesExpr) {\n      __typename\n      ... on Tree {\n        entries {\n          name\n          type\n          object {\n            __typename\n            ... on Tree {\n              entries {\n                name\n                type\n                object {\n                  __typename\n                  ... on Blob {\n                    text\n                  }\n                  ... on Tree {\n                    entries {\n                      name\n                      type\n                      object {\n                        __typename\n                        ... on Blob {\n                          text\n                        }\n                        id\n                      }\n                    }\n                  }\n                  id\n                }\n              }\n            }\n            id\n          }\n        }\n      }\n      id\n    }\n    knowledgeTree: object(expression: $knowledgeExpr) {\n      __typename\n      ... on Tree {\n        entries {\n          name\n          type\n          object {\n            __typename\n            ... on Blob {\n              text\n            }\n            id\n          }\n        }\n      }\n      id\n    }\n    operationsTree: object(expression: $operationsExpr) {\n      __typename\n      ... on Tree {\n        entries {\n          name\n          type\n          object {\n            __typename\n            ... on Blob {\n              text\n            }\n            id\n          }\n        }\n      }\n      id\n    }\n    reflectionFile: object(expression: $reflectionExpr) {\n      __typename\n      ... on Blob {\n        text\n      }\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "ff6d12efcb37ced85bf2e910479ad6d4";

export default node;
