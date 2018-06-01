import React from "react"
import ReactDOM from "react-dom"
import { Catalog, pageLoader } from "catalog"


const flows16 = require('../examples/data/flows-2016.json')
const flowsDiff1516 = require('../examples/data/flows-diff-2015-2016.json')
const locationsData = require('../examples/data/locations.json')
import { getViewportForFeature } from '../examples/utils'
import * as StaticExample from '../examples/'
console.log(StaticExample)

const pages = [
  {
    path: "/",
    title: "Documentation",
    content: pageLoader(() => import("./WELCOME.md"))
  },
]

const imports = {
  // FlowMapLayer,
  StaticExample,
  // flows16,
  // locationsData,
  getViewportForFeature,
}

ReactDOM.render(
  <Catalog title="flowmap.gl" pages={pages} imports={imports} />,
  document.getElementById("catalog")
)
