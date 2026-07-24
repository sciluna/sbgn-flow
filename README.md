# SBGNFlow
SBGNFlow is an AI-assisted and interactive workflow for generation, merging/splitting and layout of SBGN pathway maps. It supports the iterative curation of biological pathways through three modular steps that can be used in any order or combination.

The first step enables automatic conversion of hand-drawn SBGN sketches into machine-readable SBGN-ML using multimodal large language models (LLMs). It also provides an interactive interface for quickly correcting recognition errors and performing text-based edits, while biological identifiers are mapped automatically to facilitate annotation effort.

The second step supports layout-aware merging and splitting of maps, enabling users to incrementally construct larger pathway diagrams or reorganize existing networks into smaller multi-glyph components.

The final step introduces SBGN-specific layout refinement methods, combining user-guided node adjustments with automated layout polishing to improve the clarity and quality of pathway maps.

Click [here](https://sciluna.github.io/sbgn-flow/index.html) for a demo.

https://github.com/user-attachments/assets/82325ba6-d35c-4c07-b21e-9af8a0bd927e

## Software

#### Running a Local Instance
In order to deploy and run a local instance of the application, please follow the steps below (we recommend the use of version 20.14.0 of node.js):

- Installation
```
git clone https://github.com/sciluna/sbgn-flow.git
cd sbgn-flow
npm install 
```

- Running the tool
```
npm run start
```

Then, open a web browser and navigate to http://localhost:3000/. Please note that the default port is 3000 but you can run it in another port by setting 'PORT' environment variable.

## Dependencies
Each module of the workflow is developed as a standalone library/web service and is used in SBGNFlow directly or with slight adjustments.
- First step uses [image-to-sbgn](https://github.com/sciluna/image-to-sbgn) web service for image-to-SBGN conversion, text-based editing, and automated annotation.
- Second step uses [cytoscape-merge-split](https://github.com/sciluna/cytoscape.js-merge-split) extension for merge/split operations.
- Third step uses [cytoscape-sbgn-layout](https://github.com/sciluna/cytoscape.js-sbgn-layout) extension for layout operations and [cytoscape-transform](https://github.com/sciluna/cytoscape.js-transform) extension for transformation (flipping/rotation) operations.

## Credits

SBGNFlow uses [Cytoscape.js](https://js.cytoscape.org) for graph visualization and other graph-related operations. Third-party libraries used in demo: [Fomantic-UI](https://fomantic-ui.com/), [FileSaver.js](https://github.com/eligrey/FileSaver.js/), [cytoscape-context-menus](https://github.com/iVis-at-Bilkent/cytoscape.js-context-menus), [cytoscape-sbgn-stylesheet](https://github.com/PathwayCommons/cytoscape-sbgn-stylesheet), [cytoscape-fcose](https://github.com/iVis-at-Bilkent/cytoscape.js-fcose), [cytoscape-layout-utilities](https://github.com/iVis-at-Bilkent/cytoscape.js-layout-utilities), [libsbgn.js](https://github.com/sbgn/libsbgn.js), [sbgnml-to-cytoscape](https://github.com/PathwayCommons/sbgnml-to-cytoscape), [xml-formatter](https://www.npmjs.com/package/xml-formatter).  


## Team
[Hasan Balci](https://github.com/hasanbalci) and [Augustin Luna](https://github.com/cannin) of [Luna Lab](https://github.com/sciluna)
