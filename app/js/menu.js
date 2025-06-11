import { cy } from './cy-utilities.js';
import convert from 'sbgnml-to-cytoscape';
//import { convert as cytoscapeToSbgnml } from './cytoscape-to-sbgnml.js'
import { saveAs } from 'file-saver';
import format from 'xml-formatter';

let base64data;
let userInputText;
let sbgnmlText;
let img2sbgn = !(location.hostname === "localhost" || location.hostname === "127.0.0.1");
let sbgnmlfilename = "";

document.getElementById("samples").addEventListener("change", function (event) {
	let sample = event.target.value;
	let filename = "";
	if (sample == "sample1") {
		filename = "AF_sample1.png";
	}
	else if (sample == "sample2") {
		filename = "AF_sample2.png";
	}
	else if (sample == "sample3") {
		filename = "PD_sample1.png";
	}
	else if (sample == "sample4") {
		filename = "PD_sample2.png";
	}
	loadSample('app/samples/' + filename);

	const selectedSample = this.value;

	// Get the radio buttons
	const radioPD = document.getElementById('radioPD');
	const radioAF = document.getElementById('radioAF');

	// Uncheck both radios
	radioPD.checked = false;
	radioAF.checked = false;

	// Check the appropriate radio based on the selected sample
	if (selectedSample === 'sample1' || selectedSample === 'sample2') {
		radioAF.checked = true; // PD for sample1
	} else if (selectedSample === 'sample3' || selectedSample === 'sample4') {
		radioPD.checked = true; // AF for sample2
	}
});

function getMapType() {
	// Get all radio buttons with the name 'language'
	const radios = document.getElementsByName('language');

	// Loop through the radio buttons and return the one that's checked
	for (let i = 0; i < radios.length; i++) {
		if (radios[i].checked) {
			return radios[i].nextElementSibling.innerText; // Get the label text (PD or AF)
		}
	}
	return null; // If none are checked
}

function getModelType() {
	// Get all radio buttons with the name 'model'
	const radios = document.getElementsByName('model');

	// Loop through the radio buttons and return the one that's checked
	for (let i = 0; i < radios.length; i++) {
		if (radios[i].checked) {
			return radios[i].id; // Get the model id (openai or gemini)
		}
	}
	return null; // If none are checked
}

function getMapStatus() {
	// Check if keep content is active
	const keepContent = document.getElementById('mapStatus').checked;
	return keepContent;
}

let loadSample = function (fname) {
	cy.nodes().unselect();
	fetch(fname).then(function (res) {
		return res.blob();
	}).then(blob => new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = function () {
			base64data = reader.result;
			let output = document.getElementById('inputImage');
			output.src = base64data;
			output.style.removeProperty('width')
			output.style.maxHeight = "100%";
			sbgnmlText = undefined;
		};
		reader.readAsDataURL(blob)
	}))
};

$("#load-file").on("click", function (e) {
	$("#file-input").trigger('click');
});

$("#upload-file").on("click", function (e) {
	$("#file-input-cy").trigger('click');
});

document.getElementById("file-input").addEventListener("change", async function (file) {
	let input = file.target;
	let reader = new FileReader();
	reader.onload = function () {
		base64data = reader.result;
		let output = document.getElementById('inputImage');
		output.src = base64data;
		output.style.removeProperty('width')
		output.style.maxHeight = "100%";
		sbgnmlText = undefined;
	};
	reader.readAsDataURL(input.files[0]);
});

/* document.getElementById("file-input-cy").addEventListener("change", async function (event) {
	const files = Array.from(event.target.files);

	files.forEach(async (file) => {
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        cy.elements().remove();
        cy.json({elements: json.elements});
				cy.layout({name: "preset"}).run();
				let finalSbgnml = cytoscapeToSbgnml(cy, "activity flow");
				finalSbgnml = format(finalSbgnml);
				let blob = new Blob([finalSbgnml], { type: "text/xml" });
				saveAs(blob, file.name.replace(/\.[^/.]+$/, "") + ".sbgnml");

      } catch (err) {
        console.error(`Failed to parse ${file.name}:`, err);
      }
    }
	});

	let input = file.target;
	let reader = new FileReader();
	reader.onload = function () {
		let cyJson = JSON.parse(reader.result);
		cy.json({elements: cyJson.elements});
	};
	reader.readAsText(input.files[0]);
}); */

/* document.getElementById("downloadSbgnml").addEventListener("click", function () {
	let finalSbgnml = cytoscapeToSbgnml(cy, getMapType());
	finalSbgnml = format(finalSbgnml);
	let blob = new Blob([finalSbgnml], { type: "text/xml" });
	saveAs(blob, sbgnmlfilename);
}); */

document.getElementById("processData").addEventListener("click", async function (e) {
	if (base64data !== undefined) {
		// remove object view content
/* 		let objectView = document.getElementById("objectView");
		if (objectView.querySelector("#objectData") != null) {
			let objectData = document.getElementById("objectData");
			objectView.removeChild(objectData);
		} */
		// reset other data
		sbgnmlText = undefined;
		let keepContent = getMapStatus();
		if(!keepContent) {
			cy.remove(cy.elements());
		}
		cy.nodes().unselect();
		e.currentTarget.style.backgroundColor = "#f2711c";
		e.currentTarget.className += " loading";
		userInputText = document.getElementById("userInputText").value;
		await communicate(base64data, userInputText);
	}
	else {
		document.getElementById("file-type").textContent = "You must first load a valid file!";
	}
});

document.getElementById("applyLayout").addEventListener("click", function () {
	cy.layout({ name: 'fcose', randomize: false, initialEnergyOnIncremental: 0.5 }).run();
});

/* document.getElementById("openNewt").addEventListener("click", async function () {
	let finalSbgnml = cytoscapeToSbgnml(cy, getMapType());
	finalSbgnml = format(finalSbgnml);
	const filename = await openInNewtAndDelete(finalSbgnml);
}); */

// evaluate positions
let communicate = async function (pngBase64, userInputText) {
	let imageHeader = "data:image/png;base64,";
	let finalImage = imageHeader.concat(pngBase64);

	let language = getMapType();
	let model = getModelType();
	let data = {
		comment: userInputText,
		image: pngBase64,
		language: language,
		model: model
	};

	let response = await sendRequestToGPT(data);
	let resultJSON;
	try {
		resultJSON = JSON.parse(response);
		sbgnmlText = resultJSON.answer;
		sbgnmlText = sbgnmlText.replaceAll('\"', '"');
		sbgnmlText = sbgnmlText.replaceAll('\n', '');
		sbgnmlText = sbgnmlText.replaceAll('empty set', 'source and sink');
		console.log(sbgnmlText);
		await generateCyGraph();
	} catch (error) {
		console.log(error);
		alert("Output SBGNML from GPT is not in the correct format! Please try again!");
		console.log("Output SBGNML is not in the correct format");
		document.getElementById("processData").style.backgroundColor = "#d67664";
		document.getElementById("processData").classList.remove("loading");
	}
};

let sendRequestToGPT = async function (data) {
	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: JSON.stringify(data)
	};

	let res = await fetch('http://3.95.207.114/gpt', settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log("Error!");
		});
	return res;
};

// send request to sbgn validator (sybvals) to validate the resulting sbgnml content
let sendRequestToValidator = async function (sbgnmlContent) {
	let url = "http://sybvals.cs.bilkent.edu.tr/validation=showResolutionAlternatives=true";
	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: sbgnmlContent
	};

	let res = await fetch(url, settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log("Error!");
		});

	return res;
};

let generateCyGraph = async function () {
	let cyGraph = convert(sbgnmlText);
	// change node/edge ids to allow keeping current content (otherwise nodes/edges with same ids cannot be added)
	let nodeNewIdMap = new Map();
	cyGraph.nodes.forEach(node => {
		const randomId = generateNodeId();
		nodeNewIdMap.set(node.data.id, randomId);
		node.data.id = randomId;
	});
	cyGraph.nodes.forEach(node => {
		node.data.parent = nodeNewIdMap.get(node.data.parent);
	});
	cyGraph.edges.forEach(edge => {
		const randomId = generateNodeId('edge');
		edge.data.source = nodeNewIdMap.get(edge.data.source);
		edge.data.target = nodeNewIdMap.get(edge.data.target);
		edge.data.id = randomId;
	});

	cy.add(cyGraph);
	cy.nodes().forEach(
		(node) => {
			node.position({ x: node.data('bbox').x, y: node.data('bbox').y });
		}
	);
	// adjust context menu items
	let language = getMapType();
	let contextMenu = cy.contextMenus('get');
	let pdItemIDs = ["consumption", "production", "modulation", "stimulation", "catalysis", "inhibition", "macromolecule", "simpleChemical", "unspecifiedEntity", "nucleicAcidFeature", "perturbingAgent", "emptySet", "complex", "process"];
	let afItemIDs = ["positiveInfluence", "negativeInfluence", "unknownInfluence", "biologicalActivity", "delay"];
	if (language == "PD") {
		pdItemIDs.forEach(itemID => {
			contextMenu.showMenuItem(itemID);
		});
		afItemIDs.forEach(itemID => {
			contextMenu.hideMenuItem(itemID);
		});
	} else if (language == "AF") {
		pdItemIDs.forEach(itemID => {
			contextMenu.hideMenuItem(itemID);
		});
		afItemIDs.forEach(itemID => {
			contextMenu.showMenuItem(itemID);
		});
	}
	// apply layout
	cy.layout({ name: 'fcose', randomize: false }).run();
	// apply identifier mapping
	let nodesToQuery = cy.nodes().filter(node => {
		return node.data("label");
	});
	nodesToQuery = nodesToQuery.map(node => {
		return node.data("label");
	});
	nodesToQuery = nodesToQuery.filter((value, index, array) => {
		return array.indexOf(value) === index;
	});
	let identifiers = await mapIdentifiers(nodesToQuery);

	let identifiersMap = new Map();
	identifiers.forEach(item => {
		item.forEach(data => {
			if (data.score >= 0.6) {
				let query = data.match.query;
				let content = { db: data.term.db, id: data.term.id, url: data.url };
				if (identifiersMap.has(query)) {
					identifiersMap.get(query).push(content);
				} else {
					identifiersMap.set(query, [content]);
				}
			}
		});
	});
	console.log(identifiersMap);
	identifiersMap.forEach((value, key, map) => {
		let cyNodes = cy.nodes().filter(node => {
			return node.data('label') == key;
		});
		cyNodes.forEach(cyNode => {
			cyNode.data("identifierData", value);
		});
	});
	document.getElementById("processData").style.backgroundColor = "#d67664";
	document.getElementById("processData").classList.remove("loading");
};

let mapIdentifiers = async function (nodesToQuery) {
	let data = [];
	nodesToQuery.forEach(item => {
		data.push({ text: item });
	});
	data = JSON.stringify(data);

	const settings = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'text/plain'
		},
		body: data
	};

	let identifiers = await fetch('http://3.95.207.114/anno', settings)
		.then(response => response.json())
		.then(result => {
			return result;
		})
		.catch(e => {
			console.log("Error!");
		});

	return identifiers;
};

let generateObjectContent = function (node, identifierData) {
	// Create the main div element
	const div = document.createElement('div');
	div.setAttribute("id", "objectData");
	div.setAttribute("class", "inline field");

	// Create a title for the id
	const title = document.createElement('h4');
	title.textContent = node.data('label');

	// Create an edit icon 
	const editIcon = document.createElement('span');
	editIcon.textContent = '✏️'; // You can replace this with an icon image if needed
	editIcon.style.cursor = 'pointer';
	editIcon.style.marginLeft = '10px';

	// Add an event listener to switch to input field when clicked
	editIcon.addEventListener('click', () => {
		// Replace h3 with an input field
		const labelInput = document.createElement('input');
		labelInput.setAttribute("type", "text");
		labelInput.setAttribute("id", "labelInput");
		labelInput.value = title.textContent; // Set the current label text as input value

		labelInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				title.textContent = labelInput.value;
				div.replaceChild(title, labelInput);
				node.data('label', title.textContent);
			}
		});

		div.replaceChild(labelInput, title); // Replace h3 with input
	});

	div.appendChild(title);
	div.appendChild(editIcon);

	if (node.data("identifierData")) {
		// Loop through the dataArray and generate content for each object
		identifierData.forEach((dataItem) => {

			// Create a table with Fomantic UI classes
			const table = document.createElement('table');
			table.className = 'ui celled table';

			// Create a table body
			const tbody = document.createElement('tbody');

			// Create a row for each object in dataArray
			const row = document.createElement('tr');

			const dbCell = document.createElement('td');
			dbCell.textContent = dataItem.db;

			const idCell = document.createElement('td');
			const link = document.createElement('a');
			link.href = dataItem.url;
			link.textContent = dataItem.id;
			link.target = '_blank';
			idCell.appendChild(link);

			row.appendChild(dbCell);
			row.appendChild(idCell);
			tbody.appendChild(row);

			table.appendChild(tbody);
			div.appendChild(table);
		});
	}

	return div;
};

cy.on("select", "node", function (evt) {
	if(cy.nodes(":selected").length == 1) {
		let node = evt.target;
		if (node.data("label") && node.data("label") != "") {
			let objectContent = generateObjectContent(node, node.data("identifierData"));
			let objectView = document.getElementById("objectView");
			objectView.appendChild(objectContent);
		}
	} else {
		let objectView = document.getElementById("objectView");
		if (objectView.querySelector("#objectData") != null) {
			let objectData = document.getElementById("objectData");
			objectView.removeChild(objectData);
		}
	}
});

cy.on("unselect", "node", function (evt) {
	if(cy.nodes(":selected").length != 1) {
		let objectView = document.getElementById("objectView");
		if (objectView.querySelector("#objectData") != null) {
			let objectData = document.getElementById("objectData");
			objectView.removeChild(objectData);
		}
	} else {
		let node = cy.nodes(":selected")[0];
		if (node.data("label") && node.data("label") != "") {
			let objectContent = generateObjectContent(node, node.data("identifierData"));
			let objectView = document.getElementById("objectView");
			objectView.appendChild(objectContent);
		}
	}
});

async function openInNewtAndDelete(sbgnContent) {
	let filename = 'diagram_' + Date.now() + '.sbgnml';
  const response = await fetch('/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: filename,
      content: sbgnContent,
    }),
  });

  const data = await response.json();
  if (data.url) {
    // Redirect to Newt Editor with the file URL
    window.open(`https://web.newteditor.org/?URL=${data.url}`, '_blank');

		setTimeout(() => {
			fetch('/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename }),
			})
				.then((res) => res.json())
				.then((data) => {
					console.log('File deletion result:', data);
				})
				.catch((err) => {
					console.error('Failed to delete file:', err);
				});
		}, 5000); // 5000 ms = 5 seconds
  }
	return data.filename;
}

document.getElementById("inputImage").addEventListener("click", function () {
	let imageContent = document.getElementById("imageContent");
	imageContent.src = base64data;
	$('#imageModal').modal({ inverted: true }).modal('show');
});

function generateNodeId(prefix = 'node') {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

$('.ui.accordion').accordion({
	exclusive: false 
});

$('.ui.checkbox').checkbox();

export { sendRequestToGPT, getMapType };
