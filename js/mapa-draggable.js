// START VIS

var width = 1280 //window.innerWidth,
var height = 960 //window.innerHeight;

var svg = d3.select(".mapa-vis")
	.attr("preserveAspectRatio", "xMinYMin meet")
	.attr("viewBox", `0 0 ${width} ${height}`)

svg.append("rect")
        .attr("class", "vis-background")
        .attr("width", width)
        .attr("height", height)
        .on("click", function() { closeInfo() })

var viewport = svg.append("g")
	.attr("class", "viewport")

var manyBody = d3.forceManyBody()

//manyBody.strength(200)
//manyBody.theta(0.6)

var simulation = d3.forceSimulation()
	.force("charge", manyBody)
	.force("link", d3.forceLink().id(function(d) { return d.id; }))
	.force("center", d3.forceCenter(width / 2, height / 2))
	.force('collision', d3.forceCollide().radius(function(d) {
	    return node_size(d) * 2.5
	}))
	.on("tick", ticked)
	.alphaTarget(0.01)
	.alphaDecay(0.1)
	.alphaMin(0.0100000001)

// tooltip
var tooltip = d3.select('.tooltip')
var fx = new TextScramble(document.querySelector('.tooltip-text'),15)
var fxto = null


// UTILS

var color = d3.scaleOrdinal(d3.schemeCategory20)
var paleta = ['#c9b2fa','#ae92e9','#725f96','#ffc28f','#af7744','#ffc28f']

var templates = {
	doc      : { size: 16, cluster: { y: 0.3, k: 4, size: 100 }, delay: 0, color: paleta[0] },
	app      : { size:  5, cluster: { y: 1.2, k: 2, size:  60 }, delay: 1, color: paleta[1] },
	base     : { size: 20, cluster: { y: 3.0, k: 4, size: 200 }, delay: 2, color: paleta[2] },
	ti       : { size: 12, cluster: { y: 4.2, k: 3, size:  60 }, delay: 3, color: paleta[3] },
	orgao    : { size: 16, cluster: { y: 5.4, k: 3, size:  80 }, delay: 3, color: paleta[4] },
	politica : { size:  5, cluster: { y: 7.0, k: 4, size: 100 }, delay: 5, color: paleta[5] },
}

function node_size(d){
	//console.log('node.size',d.id,d.weight)
	return templates[d.tipo].size + d.weight
}

function node_color(t){
	return templates[t].color
}

function node_cluster(t){
	return templates[t].cluster.y
}

function node_delay(t,i){
	return templates[t].delay * 100 + i * 50
}

function tipo_label(t){
	switch(t){
		case 'orgao':
			return 'Órgão'
		case 'ti':
			return 'Operador de TI'
		case 'base':
			return 'Base'
		case 'politica':
			return 'Políticas Públicas'
		case 'app':
			return 'App'
		case 'doc':
			return 'Documento'
	}
}

var orgao_scale = d3.scaleLinear()
	.domain([1, 4])
	.range(['#fcd9b2', '#e07145'])
	.interpolate(d3.interpolateHcl)

// LEGENDAS UI

var legendas = [
	{ y:   5, color: paleta[0], text: 'Documentos', desc: "Documentos de identificação mais relevantes para o cidadão"},
	{ y: 175, color: paleta[1], text: 'Aplicativos', desc: "O Brasil vive uma inflação de aplicativos móveis de identidade. Os principais constam neste mapa"},
	{ y: 240, color: paleta[2], text: 'Bases', desc: "Repositórios de dados pessoais mais representativos e presentes no cotidiano do cidadão"},
	{ y: 500, color: paleta[3], text: 'Operadores de TI', desc: "Instituições responsáveis pela sustentação operacional de soluções tecnológicas para os órgãos gestores"},
	{ y: 660, color: paleta[4], text: 'Gestão', desc: "Órgãos que representam os mais importantes gestores de sistemas de identificação ou cadastros governamentais"},
	{ y: 820, color: paleta[5], text: 'Serviços e Políticas Públicas', desc: "Lista não exaustiva de políticas públicas e serviços atrelados à rede mapeada"}
]

var legendas_g = viewport.append("g")
	.attr("class", "legenda")
	.selectAll('g')
	.data(legendas)

var legenda = legendas_g.enter().append('g')

legenda
	.append('line')
	.attr("class", 'legenda-line')
	.attr("x1", 20 )
	.attr("y1", function(d) { return d.y })
	.attr("x2", width - 20)
	.attr("y2", function(d) { return d.y });

legenda
	.append('text')
	.attr("class", 'legenda-text')
	.text(function(d) { return d.text })
	.attr('x', 20)
	.attr('y', function(d){ return d.y + 25 })
	.on("mouseover", legenda_mouseover)
	.on("mouseout", legenda_mouseout)

// GRAPH

var graph = {}

var _links = viewport.append("g")
	.attr("class", "links")

var _nodes = viewport.append("g")
	.attr("class", "nodes")

var _labels = viewport.append("g")
	.attr("class", "labels")

// LOAD DATA

d3.csv('./data/data-nodes-fixed.csv?v=' + now)
  .row(d3.dsvParse).get(function(data){

	var _nodes = data
	var _nodesori = []

	data.map(function(o){
		_nodesori.push(o)
	})

	d3.csv('./data/data-links.csv?v=' + now)
	  .row(d3.dsvParse).get(function(data){

		var _relations = data
		var _links = []
		var _linksori = []
		
		_relations.map(function(d){
			_links.push({base: d.base, source: d.source, relation: d.relation, target: d.target})	
			_linksori.push({base: d.base, source: d.source, relation: d.relation, target: d.target})	
		})

		var k = {
			app: 0,
			base: 0,
			doc: 0,
			orgao: 0,
			ti: 0,
			politica: 0,
			servico: 0
		}

		_nodes.map(function(d){
			
			// offset
			
			var loop = templates[d.tipo].cluster.size
			var step = loop / templates[d.tipo].cluster.k

			d.offsetY = k[d.tipo]
			k[d.tipo] += step
			k[d.tipo] = k[d.tipo] % loop

			d.x = Number(d.x)
			d.y = Number(d.y)

			// weight, color and label
			
			var arr = _.filter(_linksori, function(o) { return o.target  == d.id || o.source  == d.id })

			d.color = node_color(d.tipo)
			d.tipo_label = tipo_label(d.tipo)
			d.rel_ids = _.uniq(_.map(arr,'base'))

			if(d.tipo == 'ti'){
				var arr2 = _.filter(arr, function(o) { return o.relation == 'gestao' })
				d.weight = arr2.length * 4
			} else {
				d.weight = arr.length
			}
			

		})

		// MULTIPLE LINKS: START

		_.each(_links, function(link) {

			var same = _.filter(_links, {
				'source': link.source,
				'target': link.target
			})

			_.each(same, function(s, i) {
				if(!s.linkNum){
					s.linkNum = (i + 1)
				}
			})

		})

		// MULTIPLE LINKS: END

		graph.nodes = _nodes
		graph.links = _links
		graph.data = {}
		graph.data.nodes = _nodesori
		graph.data.links = _linksori

		console.log(graph)
		
		update(graph.nodes, graph.links)
	})
})

function update(data_n,data_l){

	var t = d3.transition().duration(750);

	var nodes  = _nodes.selectAll('.node').data(data_n, function(d) { return d.id })
	var labels = _labels.selectAll('.label').data(data_n, function(d) { return d.id })
	var links  = _links.selectAll('.link').data(data_l, function(d) { return d.source + '_' + d.target })

	// NODES

	nodes
		.exit()
		.transition(t)
		.attr("r", 1e-6)
		.remove()

	nodes.enter()
		.append("g")
		.attr("class", function(d) {
			return "node " + d.id + " " + d.rel_ids.join(" ")
		})
		.attr('node_id', function(d) {
			return d.id;
		})
		.on("dblclick", dblclick)
		.call(drag_handler)
		.append("circle")
		.attr("r", 0)
		.on("mouseover", node_mouseover)
		.on("mouseout", node_mouseout)
		// .on("click", node_click)
		.transition(t)
		.delay(function(d, i) { return node_delay(d.tipo,i) })
		.attr("r", function(d){ return node_size(d) } )
		.attr("fill", function(d) { return d.color })
		

	// LABELS

	labels.enter()
		.append("g")
		.attr("class", function(d) {
			return "label node-" + d.tipo + " " + d.id + " " + d.rel_ids.join(" ")
		})
		.attr('label_id', function(d) {
			return d.id;
		})
		.attr('label_nome', function(d) {
			return d.nome
		})
		.append("text")
			.text(function(d) { return d.nome; })
			.attr("text-anchor", "middle")
			.attr('x', 0)
			.attr('y', function(d){ return node_size(d) + 16 })
			.attr("opacity", 0)
			.transition(t)
			.delay(function(d, i) { return node_delay(d.tipo, i + 10) })
			.attr("opacity", 1)

	labels.exit().remove()

	// LINKS

	links.exit().remove()

	links.enter()
		// .append("line")
		.append("path")
		.attr("class", "link")
		.attr("class", function(d) {
			return d3.select(this).attr("class")
				// + ' ' + d.source
				// + ' ' + d.target
				// + ' ' + d.relation
				+ ' ' + d.base
		})
		.attr("opacity", 0)
		//.attr("stroke-width", function(d) { return Math.sqrt(d.value); })
		.transition(t)
		.delay(4000)
		.attr("opacity", 1)


	simulation
		.nodes(data_n)
		.force("link")
		.links(data_l)


	//drag_handler(nodes)
	//simulation.alpha(0.1)

	console.log('UPDATE VIS', data_n, data_l)

	ticked()

}

function ticked() {

	simulation.alpha(0.1)

	//nodes.filter(function(d){return d.id == 'governo'}).attr('fx',0).attr('fy',0)

	var nodes  = _nodes.selectAll('.node')
	var links  = _links.selectAll('.link')
	var labels = _labels.selectAll('.label')

	if(nodes){

		nodes.each(function(d, i) {
			ky = 0.1
			d.x -= (d.x - width / 2) * 8 * 0.0001;
			d.y -= (d.y + d.offsetY - (node_cluster(d.tipo) + 1) * 120) * 5 * ky;
		})

		nodes
			.attr("transform", function(d) {
				d.x = Math.max(Math.min(d.x,width-100),200)
				return "translate(" + d.x + "," + d.y + ")";
			})
	}

	if(links){
		links
			.attr("d", positionLink)
			// .attr("x1", function(d) { return d.source.x; })
			// .attr("y1", function(d) { return d.source.y; })
			// .attr("x2", function(d) { return d.target.x; })
			// .attr("y2", function(d) { return d.target.y; });
	}
	if(labels){
		labels
			.attr("transform", function(d) {
				return "translate(" + d.x + "," + d.y + ")";
			})
	}

}

function positionLink(d) {

	var offset = 30 * d.linkNum;

	var midpoint_x = (d.source.x + d.target.x) / 2;
	var midpoint_y = (d.source.y + d.target.y) / 2;

	var dx = (d.target.x - d.source.x);
	var dy = (d.target.y - d.source.y);

	var normalise = Math.sqrt((dx * dx) + (dy * dy));

	var offSetX = midpoint_x + offset * (dy/normalise);
	var offSetY = midpoint_y - offset * (dx/normalise);

	return  "M" + d.source.x + "," + d.source.y +
			"S" + offSetX + "," + offSetY +
			" " + d.target.x + "," + d.target.y;
}

// DRAG

var drag_handler = d3.drag()
	.on("start", drag_start)
	.on("drag", drag_drag)
	.on("end", drag_end)

function drag_start(d) {
	if (!d3.event.active) simulation.alphaTarget(0.1).restart();
	d.fx = d.x;
	d.fy = d.y;
	d3.select(this).classed("fixed", d.fixed = true);
}

function drag_drag(d) {
	d.fx = d3.event.x;
	d.fy = d3.event.y;
}

function drag_end(d) {
	if (!d3.event.active) simulation.alphaTarget(0.01);
	//d.fx = null;
	//d.fy = null;
}

function dblclick(d) {
	d3.select(this).classed("fixed", d.fixed = false);
	d.fx = null;
	d.fy = null;
}


//*/

// ZOOM

var zoom_handler = d3.zoom()
	.on("zoom", zoom_actions)

function zoom_actions(){
	viewport.attr("transform", d3.event.transform)
}

//zoom_handler(svg)


// RESIZE

function resize() {
	
	width = window.innerWidth
	height = window.innerHeight

	svg.attr("width", width).attr("height", height);

	//force.size([force.size()[0]+(width-w)/zoom.scale(),force.size()[1]+(height-h)/zoom.scale()]).resume();
}


//d3.select(window).on("resize", resize)
//resize()

// EVENTS

function legenda_mouseover(d) {

	if($(window).width() < 768) return

	var svg_w = d3.select('.mapa-viewport').node().getBoundingClientRect().width
	var scale = svg_w / width

	var top = 160 + (d.y + 50) * scale
	var left = 180

	d3.selectAll('.tooltip-title')
		.text(d.text)
		.style('color', d.color )

	tooltip
		.classed('show', true)
		.style('top', top + 'px')
		.transition()
		.duration(100)
		.style('left', left + 'px')

	fx.setText(d.desc)
	sound_over.play()
}

function legenda_mouseout(d) {

	if($(window).width() < 768) return

	//fx.setText(d.nome)
	tooltip.classed('show', false)
}

function node_mouseover(d) {

	if($(window).width() < 768) return

	// label

	var text = d3.select('.label[label_id="' + d.id + '"]')
	//.classed('show', true)

	if(_.indexOf(['base','doc','orgao','ti'], d.tipo) != -1){
		text.classed('hidden',true)
	}

	// links

	d3.selectAll('.mapa').classed('highlight', true)
	_.forEach(d.rel_ids, function(id){
		d3.selectAll('.link.' + id).classed('highlight',true)
		d3.selectAll('.node.' + id).classed('highlight',true)
	})

	console.log('contexts',d.rel_ids,d.x,d.y)

	// tooltip

	var svg_w = d3.select('.mapa-viewport').node().getBoundingClientRect().width
	var scale = svg_w / width

	var top = d.y < height * .8
		? d.y * scale + (node_size(d) * 0.5 + 30) * scale + 160
		: d.y * scale - (node_size(d) * scale + 90) + 160

	var left = d.x < width * .75
		? (d.x + 20) * scale
		: (d.x - 20) * scale

	// window safe area
	left = Math.min(Math.max(180,left),width * scale - 180)

	//console.log(svg_w, scale, top, left)

	console.log(d)

	d3.selectAll('.tooltip-title')
		.text(d.tipo_label)
		.style('color', function(){ return d.color })

	tooltip
		.classed('show', true)
		.style('top', top + 'px')
		.transition()
		.duration(100)
		.style('left', left + 'px')
		
	fx.setText(d.nomecompleto || d.nome)

	// if(d.nomecompleto){
	// 	fxto = setTimeout(function(){
	// 		fx.setText(d.nomecompleto)
	// 	},1000)
	// }

	sound_over.play()

}

function node_mouseout(d) {
	
	if($(window).width() < 768) return

	// label

	var text = d3.select('.label[label_id="' + d.id + '"]')
	//.classed('show', false)

	if(_.indexOf(['base','doc','orgao','ti'], d.tipo) != -1){
		text.classed('hidden', false)
	}

	// links

	d3.selectAll('.mapa').classed('highlight', false)
	_.forEach(d.rel_ids, function(id){
		d3.selectAll('.link.' + id).classed('highlight',false)
		d3.selectAll('.node.' + id).classed('highlight',false)
	})

	// tooltip

	//clearTimeout(fxto)
	fx.setText(d.nome)
	tooltip.classed('show', false)
}

function node_click(d) {
	sound_click.play()
	console.log('click', d)

	if(current_id == d.id){
		closeInfo()
	} else {
		showInfo(d.tipo, d.id)
		ga('send', 'event', 'node', 'click', d.tipo + " - " + d.nomecompleto) 
		// if (_.indexOf(['base','ti','orgao','doc'], d.tipo) != -1) {
		// 	showInfo(d.tipo, d.id)
		// } else {
		// 	var base = _.find(graph.data.links, function(o) { return o.target == d.id })
		// 	showInfo('base', base.base)
		// }
	}
}

// INFO PANEL

var current_id = null

function showInfo(tipo, id) {

	var w = $(window).width()

	var vis = d3.select(".mapa")
	vis.classed("show-info", true)

	// old
	d3.selectAll('.link.show').classed('show', false)
	d3.selectAll('.node.show').classed('show', false)
	d3.selectAll('.label.show').classed('show', false)

	// new 
	var arr = _.filter(graph.data.links, function(o) { return o.target  == id || o.source  == id })
	var bases = _.uniq(_.map(arr,'base'))

	_.forEach(bases, function(base){
		d3.selectAll('.link.' + base).classed('show', true)
		d3.selectAll('.node.' + base).classed('show', true)
		d3.selectAll('.label.' + base).classed('show', true)
	})

	var info = w < 768 ? d3.select('.mapa-info-mobile') : d3.select('.mapa-info')
	var content = w < 768 ? d3.select('.mapa-info-mobile-content') : d3.select('.mapa-info-content')

	info.classed('is-loading',true)
	content.html('')

	var node = _.find(graph.nodes, function(o){ return id == o.id })

	d3.text("./data/info/" + tipo + '-' + id + ".yml?v=" + now, function(error, text) {
		if (error) throw error
		var data = jsyaml.safeLoad(text)
		data.title = node.nomecompleto || node.nome
		content.html(template_info(data))
		info.classed('is-loading',false)
	})

	current_id = id

	//doScroll( 0 )
}

function closeInfo(){

	var w = $(window).width()

	vis = d3.select(".mapa")
	vis.classed("show-info", false)

	d3.selectAll('.link.show').classed('show', false)
	d3.selectAll('.node.show').classed('show', false)
	d3.selectAll('.label.show').classed('show', false)

	current_id = null

	if(w < 768) {
		d3.select('.mapa-info-mobile-content').html('')
	}

}

d3.select(".mapa-info-close").on("click",function(e){

	d3.event.preventDefault()

	sound_click.play()
	closeInfo()

})

function exportcsv(){
	var s = ''
	graph.nodes.map(function(el){
		s += el.tipo + ',' + el.id + ',' + el.nome + ',' + el.nomecompleto + ',' + Math.round(el.x) + ',' + Math.round(el.y) + '\n'
	})
	console.log(s)
}