import cytoscape from 'cytoscape';
import fcose from "cytoscape-fcose";
import layoutUtilities from 'cytoscape-layout-utilities';
import sbgnLayout from "cytoscape-sbgn-layout";
import sbgnStylesheet from 'cytoscape-sbgn-stylesheet';
import contextMenus from 'cytoscape-context-menus';
import transform from 'cytoscape-transform';
import mergeSplit from 'cytoscape-merge-split';
import { getMapType } from './menu.js'

cytoscape.use(fcose);
cytoscape.use(contextMenus);
cytoscape.use(layoutUtilities);
cytoscape.use(sbgnLayout);
cytoscape.use(transform);
cytoscape.use(mergeSplit);

let cy = window.cy = cytoscape({
	container: document.getElementById('cy'),
	style: sbgnStylesheet(cytoscape),
});

let nodeClassesWithoutLabel = ["process", "omitted process", "uncertain process", "association", "dissociation", "and", "or", "not", "delay"];

cy.style().selector('node')
	.style({
		'content': (node) => {
			if(nodeClassesWithoutLabel.includes(node.data("class"))) {
				if (node.data("class") == "omitted process") {
					return "\\\\";
				} else if (node.data("class") == "uncertain process") {
					return "?";
				} else if (node.data("class") == "and") {
					return "AND";
				} else if (node.data("class") == "or") {
					return "OR";
				} else if (node.data("class") == "not") {
					return "NOT";
				} else if (node.data("class") == "delay") {
					return "\u03C4";
				} else {
					return "";
				}
			} else {
				return node.data("label");
			}
		}
	})
	.update();

cy.style().selector('.pinned')
	.style({
		'underlay-color': 'lightgrey',
		'underlay-padding': '5px',
		'underlay-opacity': 1,
	})
	.update();

cy.style().selector(':selected')
	.style({
		"border-width": 2,
		"border-color": "rgb(1,105,217)",
		"background-color": "white",
		"line-color": "rgb(1,105,217)",
		"target-arrow-color": "rgb(1,105,217)",
		"font-weight": "normal"
	})
	.update();

cy.layoutUtilities({
	desiredAspectRatio: cy.width()/cy.height()
});

cy.transform();
cy.mergeSplit({
	animate: "end", 
	animationDuration: 1500,
	nodeMatcher: (n1, n2, options) => {  // n1 from source component, n2 from target component
		let isMatched = false;
		if (n1.data('class') != n2.data('class')) {
			return false;
		} else {
			// if nodes are process like, then at least one input and output should match
			let nodeClassesWithoutLabel = ["process", "omitted process", "uncertain process", "association", "dissociation", "and", "or", "not", "delay"];
			if(nodeClassesWithoutLabel.includes(n1.data("class")) && n1.data("class") == n2.data("class")) {
				// find input nodes
				let n1IncomerEdges = n1.incomers().edges();
				let n1InputNodes = cy.collection();
				n1IncomerEdges.forEach(edge => {
					if (edge.data("class") == "consumption") {
						n1InputNodes.merge(edge.source());
					}
				});
				let n2IncomerEdges = n2.incomers().edges();
				let n2InputNodes = cy.collection();
				n2IncomerEdges.forEach(edge => {
					if (edge.data("class") == "consumption") {
						n2InputNodes.merge(edge.source());
					}
				});
				let isInputMatch = false;
				n1InputNodes.forEach(node1 => {
					n2InputNodes.forEach(node2 => {
						if (options.checkLabel && !options.checkIdentifier) {
							if(node1.data("label") == node2.data("label")) {
								isInputMatch = true;
							}
						} else if (!options.checkLabel && options.checkIdentifier) {
							if(node1.data("identifierData") && node2.data("identifierData") && node1.data("identifierData")[0].id == node2.data("identifierData")[0].id) {
								isInputMatch = true;
							}
						} else if (options.checkLabel && options.checkIdentifier) {
							if(node1.data("label") == node2.data("label") && node1.data("identifierData") && node2.data("identifierData") && node1.data("identifierData")[0].id == node2.data("identifierData")[0].id) {
								isInputMatch = true;
							}
						}
					});
				});

				// find output nodes
				let n1OutgoingEdges = n1.outgoers().edges();
				let n1OutputNodes = cy.collection();
				n1OutgoingEdges.forEach(edge => {
					if (edge.data("class") == "production") {
						n1OutputNodes.merge(edge.target());
					}
				});
				let n2OutgoingEdges = n2.outgoers().edges();
				let n2OutputNodes = cy.collection();
				n2OutgoingEdges.forEach(edge => {
					if (edge.data("class") == "production") {
						n2OutputNodes.merge(edge.target());
					}
				});
				let isOutputMatch = false;
				n1OutputNodes.forEach(node1 => {
					n2OutputNodes.forEach(node2 => {
						if (options.checkLabel && !options.checkIdentifier) {
							if(node1.data("label") == node2.data("label")) {
								isOutputMatch = true;
							}
						} else if (!options.checkLabel && options.checkIdentifier) {
							if(node1.data("identifierData") && node2.data("identifierData") && node1.data("identifierData")[0].id == node2.data("identifierData")[0].id) {
								isOutputMatch = true;
							}
						} else if (options.checkLabel && options.checkIdentifier) {
							if(node1.data("label") == node2.data("label") && node1.data("identifierData") && node2.data("identifierData") && node1.data("identifierData")[0].id == node2.data("identifierData")[0].id) {
								isOutputMatch = true;
							}
						}
					});
				});

				if (isInputMatch && isOutputMatch) {
					isMatched = true;
				}
			} else {
				if (options.checkLabel && !options.checkIdentifier) {
					// check if labels match
					if (!!(n1.data('label') && n1.data('label') != '' && n2.data('label') && n2.data('label') != '' && n1.data('label') === n2.data('label'))) {
						isMatched = true;
					}
				} else if (!options.checkLabel && options.checkIdentifier) {
					// check if identifiers match
					if (!!(n1.data('identifierData') && n2.data('identifierData') && n1.data('identifierData')[0].id === n2.data('identifierData')[0].id)) {
						isMatched = true;
					}
				} else if (options.checkLabel && options.checkIdentifier) {
					// check if both labels and identifiers match
					if (!!(n1.data('label') && n1.data('label') != '' && n2.data('label') && n2.data('label') != '' && n1.data('label') === n2.data('label')) &&
						!!(n1.data('identifierData') && n2.data('identifierData') && n1.data('identifierData')[0].id === n2.data('identifierData')[0].id)) {
						isMatched = true;
					}
				} else {
					isMatched = false;
				}
			}
			// apply a final check for parent nodes if they exist
			if (isMatched) {
				if (n1.parent().length > 0 && n2.parent().length > 0) {
					if (n1.parent()[0].data('label') == n2.parent()[0].data('label')) {
						return true;
					} else {
						return false;
					}
				} else {
					return true;
				}
			} else {
				return false;
			}
		}
	},
	edgeMatcher: (e1, e2, options) => {  // e1 from source component, e2 from target component
		// check if source and target labels match
		let isMatched = false;
		if (e1.data('class') != e2.data('class')) {
			return false;
		} else {
			if (options.checkLabel && !options.checkIdentifier) {
				if (e1.source().data('label') === e2.source().data('label') && e1.target().data('label') === e2.target().data('label')) {
					if (options.checkCardinality && e1.data('cardinality') === e2.data('cardinality')) {
						isMatched = true;
					} else if (!options.checkCardinality) {
						isMatched = true;
					}
				}
			} else if (!options.checkLabel && options.checkIdentifier) {
				if (options.language == "AF") { 
					if (e1.source().data('identifierData') && e2.source().data('identifierData') && e1.target().data('identifierData') && e2.target().data('identifierData') &&
						e1.source().data('identifierData')[0].id === e2.source().data('identifierData')[0].id &&
						e1.target().data('identifierData')[0].id === e2.target().data('identifierData')[0].id) {
						if (options.checkCardinality && e1.data('cardinality') === e2.data('cardinality')) {
							isMatched = true;
						} else if (!options.checkCardinality) {
							isMatched = true;
						}
					}
				} else { 
					if ((e1.source().data('identifierData') && e2.source().data('identifierData') && e1.source().data('identifierData')[0].id === e2.source().data('identifierData')[0].id) || (e1.target().data('identifierData') && e2.target().data('identifierData') && e1.target().data('identifierData')[0].id === e2.target().data('identifierData')[0].id)) {
						if (options.checkCardinality && e1.data('cardinality') === e2.data('cardinality')) {
							isMatched = true;
						} else if (!options.checkCardinality) {
							isMatched = true;
						}
					}
				}
			} else if (options.checkLabel && options.checkIdentifier) {
				if (options.language == "AF") { 
					if (e1.source().data('label') === e2.source().data('label') && e1.target().data('label') === e2.target().data('label') &&
						e1.source().data('identifierData') && e2.source().data('identifierData') && e1.target().data('identifierData') && e2.target().data('identifierData') &&
						e1.source().data('identifierData')[0].id === e2.source().data('identifierData')[0].id &&
						e1.target().data('identifierData')[0].id === e2.target().data('identifierData')[0].id) {
						if (options.checkCardinality && e1.data('cardinality') === e2.data('cardinality')) {
							isMatched = true;
						} else if (!options.checkCardinality) {
							isMatched = true;
						}
					}
				} else { 
					if ((e1.source().data('label') === e2.source().data('label') && e1.source().data('identifierData') && e2.source().data('identifierData') && e1.source().data('identifierData')[0].id === e2.source().data('identifierData')[0].id) || (e1.target().data('label') === e2.target().data('label') && e1.target().data('identifierData') && e2.target().data('identifierData') && e1.target().data('identifierData')[0].id === e2.target().data('identifierData')[0].id)) {
						if (options.checkCardinality && e1.data('cardinality') === e2.data('cardinality')) {
							isMatched = true;
						} else if (!options.checkCardinality) {
							isMatched = true;
						}
					}
				}
			}
		}
		return isMatched;
	},
	checkLabel: true,
	checkIdentifier: false,
	checkCardinality: false,
	language: "PD"
});

var contextMenuOptions = {
	evtType: 'cxttap',
	// List of initial menu items
	// A menu item must have either onClickFunction or submenu or both
	menuItems: [
		{
			id: 'changeEdgeClass', // ID of menu item
			content: 'Change class', // Display content of menu item
			selector: "edge",
			coreAsWell: false, // Whether core instance have this item on cxttap
			submenu: [
				{
					id: 'consumption',
					content: 'Consumption',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'consumption');
					}
				},
				{
					id: 'production',
					content: 'Production',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'production');
					}
				},
				{
					id: 'modulation',
					content: 'Modulation',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'modulation');
					}
				},
				{
					id: 'stimulation',
					content: 'Stimulation',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'stimulation');
					}
				},
				{
					id: 'catalysis',
					content: 'Catalysis',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'catalysis');
					}
				},
				{
					id: 'inhibition',
					content: 'Inhibition',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'inhibition');
					}
				},
				{
					id: 'positiveInfluence',
					content: 'Positive influence',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'positive influence');
					}
				},
				{
					id: 'negativeInfluence',
					content: 'Negative influence',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'negative influence');
					}
				},
				{
					id: 'unknownInfluence',
					content: 'Unknown influence',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'unknown influence');
					}
				},
				{
					id: 'necessaryStimulation',
					content: 'Necessary stimulation',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'necessary stimulation');
					}
				},
				{
					id: 'logicArc',
					content: 'Logic arc',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'logic arc');
					}
				},
				{
					id: 'equivalence',
					content: 'Equivalence Arc',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'equivalence arc');
					}
				}
			]
		},
		{
			id: 'changeNodeClass', // ID of menu item
			content: 'Change class', // Display content of menu item
			selector: 'node',
			coreAsWell: false, // Whether core instance have this item on cxttap
			submenu: [
				{
					id: 'macromolecule',
					content: 'Macromolecule',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'macromolecule');
					}
				},
				{
					id: 'simpleChemical',
					content: 'Simple chemical',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'simple chemical');
					}
				},
				{
					id: 'unspecifiedEntity',
					content: 'Unspecified entity',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'unspecified entity');
					}
				},
				{
					id: 'nucleicAcidFeature',
					content: 'Nucleic acid feature',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'nucleicAcidFeature');
					}
				},
				{
					id: 'perturbingAgent',
					content: 'Perturbing agent',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'perturbing agent');
					}
				},
				{
					id: 'emptySet',
					content: 'Empty set',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'empty set');
					}
				},
				{
					id: 'complex',
					content: 'Complex',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'complex');
					}
				},
				{
					id: 'biologicalActivity',
					content: 'Biological activity',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'biological activity');
					}
				},
				{
					id: 'phenotype',
					content: 'Phenotype',
					selector: 'node',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'phenotype');
					}
				},
				{
					id: 'compartment',
					content: 'Compartment',
					selector: 'node',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'compartment');
					}
				},
				{
					id: 'tag',
					content: 'Tag',
					selector: 'node',
					onClickFunction: function (event) {
						let target = event.target || event.cyTarget;
						target.data('class', 'tag');
					}
				},
				{
					id: 'process',
					content: 'Process',
					submenu: [
						{
							id: 'genericProcess',
							content: 'Process',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'process');
								target.data("label", "");
							}
						},
						{
							id: 'omittedProcess',
							content: 'Omitted process',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'omitted process');
								target.data("label", "\\\\");
							}
						},
						{
							id: 'uncertainProcess',
							content: 'Uncertain process',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'uncertain process');
								target.data("label", "?");
							}
						},
						{
							id: 'association',
							content: 'Association',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'association');
								target.data("label", "");
							}
						},
						{
							id: 'dissociation',
							content: 'Dissociation',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'dissociation');
								target.data("label", "");
							}
						}
					]
				},
				{
					id: 'logicalOperator',
					content: 'Logical operator',
					selector: 'node',
					submenu: [
						{
							id: 'and',
							content: 'AND',
							selector: 'node',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'and');
								target.data("label", "AND");
							}
						},
						{
							id: 'or',
							content: 'OR',
							selector: 'node',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'or');
								target.data("label", "OR");
							}
						},
						{
							id: 'not',
							content: 'NOT',
							selector: 'node',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'not');
								target.data("label", "NOT");
							}
						},
						{
							id: 'delay',
							content: 'Delay',
							selector: 'node[language = "AF"]',
							onClickFunction: function (event) {
								let target = event.target || event.cyTarget;
								target.data('class', 'delay');
								target.data("label", "\u03C4");
							}
						}
					]
				}
			]
		},
		{
			id: 'changeDirection',
			content: 'Change direction',
			selector: 'edge',
			onClickFunction: function (event) {
				let edge = event.target || event.cyTarget;
				let source = edge.source();
				let target = edge.target();
				edge.move({
					source: target.id(),
					target: source.id()
				});
			}
		},
		{
			id: 'remove',
			content: 'Remove',
			selector: 'node, edge',
			onClickFunction: function (event) {
				let target = event.target || event.cyTarget;
				target.remove();
			}
		},
		{
			id: 'addEdge',
			content: 'Add edge btw selected nodes',
			coreAsWell: true,
			onClickFunction: function (event) {
				const langauge = getMapType();
				if (cy.nodes(':selected').length > 1) {
					if (langauge == 'PD') {
						cy.add({ group: 'edges', data: { source: cy.nodes(':selected')[0].id(), target: cy.nodes(':selected')[1].id(), class: 'modulation' } });
					} else {
						cy.add({ group: 'edges', data: { source: cy.nodes(':selected')[0].id(), target: cy.nodes(':selected')[1].id(), class: 'positive influence' } });
					}
				}
			}
		},
		{
			id: 'addNode',
			content: 'Add node',
			coreAsWell: true,
			onClickFunction: function (event) {
					const langauge = getMapType();
					if (langauge == 'PD') {
						cy.add({ group: 'nodes', data: { class: 'macromolecule', label: 'Node', 'stateVariables': [], 'unitsOfInformation': [] }, position: { x: event.position.x, y: event.position.y } });
					} else {
						cy.add({ group: 'nodes', data: { class: 'biological activity', label: 'Node', 'stateVariables': [], 'unitsOfInformation': [] }, position: { x: event.position.x, y: event.position.y } });
					}
			}
		},
		{
			id: 'removeSelected',
			content: 'Remove selected',
			coreAsWell: true,
			onClickFunction: function (event) {
				cy.elements(':selected').remove();
			}
		}
	],
	// css classes that menu items will have
	menuItemClasses: [
		// add class names to this list
	],
	// css classes that context menu will have
	contextMenuClasses: [
		// add class names to this list
	],
	// Indicates that the menu item has a submenu. If not provided default one will be used
	submenuIndicator: { src: 'app/img/submenu-indicator-default.svg', width: 12, height: 12 }
};

let instance = cy.contextMenus(contextMenuOptions);

export { cy };