import{n as e}from"./chunk-DnJy8xQt.js";import{B as t,C as n,Dt as r,E as i,Fn as a,On as o,_ as s,ar as c,b as l,hn as u,ir as d,j as f,jn as p,kn as m,p as h,s as g,w as _,wn as v,z as y}from"./mermaid-934da031-BkCLFy2D.js";import{i as b,n as x,t as S}from"./graphlib-1WKfCcyu.js";import{n as C,t as w}from"./index-9bae90f3-Byz1c4Jo.js";function T(e,t){return!!e.children(t).length}function E(e){return D(e.v)+`:`+D(e.w)+`:`+D(e.name)}function D(e){return e?String(e).replace(j,`\\:`):``}function O(e,t){t&&e.attr(`style`,t)}function k(e,t,n){t&&e.attr(`class`,t).attr(`class`,n+` `+e.attr(`class`))}function A(e,t){var n=t.graph();if(r(n)){var i=n.transition;if(u(i))return i(e)}return e}var j,M=e((()=>{b(),j=/:/g}));function N(e,t){var n=e.append(`foreignObject`).attr(`width`,`100000`),r=n.append(`xhtml:div`);r.attr(`xmlns`,`http://www.w3.org/1999/xhtml`);var i=t.label;switch(typeof i){case`function`:r.insert(i);break;case`object`:r.insert(function(){return i});break;default:r.html(i)}O(r,t.labelStyle),r.style(`display`,`inline-block`),r.style(`white-space`,`nowrap`);var a=r.node().getBoundingClientRect();return n.attr(`width`,a.width).attr(`height`,a.height),n}var P=e((()=>{M()})),F,I,L,R,z,B,V,H,U,W,G=e((()=>{p(),P(),S(),w(),n(),v(),F={},I=function(e){let t=Object.keys(e);for(let n of t)F[n]=e[n]},L=async function(e,t,n,r,a,o){let c=r.select(`[id="${n}"]`),u=Object.keys(e);for(let n of u){let r=e[n],u=`default`;r.classes.length>0&&(u=r.classes.join(` `)),u+=` flowchart-label`;let d=l(r.styles),p=r.text===void 0?r.id:r.text,m;if(i.info(`vertex`,r,r.labelType),r.labelType===`markdown`)i.info(`vertex`,r,r.labelType);else if(h(s().flowchart.htmlLabels))m=N(c,{label:p}).node(),m.parentNode.removeChild(m);else{let e=a.createElementNS(`http://www.w3.org/2000/svg`,`text`);e.setAttribute(`style`,d.labelStyle.replace(`color:`,`fill:`));let t=p.split(g.lineBreakRegex);for(let n of t){let t=a.createElementNS(`http://www.w3.org/2000/svg`,`tspan`);t.setAttributeNS(`http://www.w3.org/XML/1998/namespace`,`xml:space`,`preserve`),t.setAttribute(`dy`,`1em`),t.setAttribute(`x`,`1`),t.textContent=n,e.appendChild(t)}m=e}let _=0,v=``;switch(r.type){case`round`:_=5,v=`rect`;break;case`square`:v=`rect`;break;case`diamond`:v=`question`;break;case`hexagon`:v=`hexagon`;break;case`odd`:v=`rect_left_inv_arrow`;break;case`lean_right`:v=`lean_right`;break;case`lean_left`:v=`lean_left`;break;case`trapezoid`:v=`trapezoid`;break;case`inv_trapezoid`:v=`inv_trapezoid`;break;case`odd_right`:v=`rect_left_inv_arrow`;break;case`circle`:v=`circle`;break;case`ellipse`:v=`ellipse`;break;case`stadium`:v=`stadium`;break;case`subroutine`:v=`subroutine`;break;case`cylinder`:v=`cylinder`;break;case`group`:v=`rect`;break;case`doublecircle`:v=`doublecircle`;break;default:v=`rect`}let y=await f(p,s());t.setNode(r.id,{labelStyle:d.labelStyle,shape:v,labelText:y,labelType:r.labelType,rx:_,ry:_,class:u,style:d.style,id:r.id,link:r.link,linkTarget:r.linkTarget,tooltip:o.db.getTooltip(r.id)||``,domId:o.db.lookUpDomId(r.id),haveCallback:r.haveCallback,width:r.type===`group`?500:void 0,dir:r.dir,type:r.type,props:r.props,padding:s().flowchart.padding}),i.info(`setNode`,{labelStyle:d.labelStyle,labelType:r.labelType,shape:v,labelText:y,rx:_,ry:_,class:u,style:d.style,id:r.id,domId:o.db.lookUpDomId(r.id),width:r.type===`group`?500:void 0,type:r.type,dir:r.dir,props:r.props,padding:s().flowchart.padding})}},R=async function(e,t,n){i.info(`abc78 edges = `,e);let r=0,o={},c,u;if(e.defaultStyle!==void 0){let t=l(e.defaultStyle);c=t.style,u=t.labelStyle}for(let n of e){r++;let d=`L-`+n.start+`-`+n.end;o[d]===void 0?(o[d]=0,i.info(`abc78 new entry`,d,o[d])):(o[d]++,i.info(`abc78 new entry`,d,o[d]));let p=d+`-`+o[d];i.info(`abc78 new link id to be used is`,d,p,o[d]);let m=`LS-`+n.start,h=`LE-`+n.end,v={style:``,labelStyle:``};switch(v.minlen=n.length||1,n.type===`arrow_open`?v.arrowhead=`none`:v.arrowhead=`normal`,v.arrowTypeStart=`arrow_open`,v.arrowTypeEnd=`arrow_open`,n.type){case`double_arrow_cross`:v.arrowTypeStart=`arrow_cross`;case`arrow_cross`:v.arrowTypeEnd=`arrow_cross`;break;case`double_arrow_point`:v.arrowTypeStart=`arrow_point`;case`arrow_point`:v.arrowTypeEnd=`arrow_point`;break;case`double_arrow_circle`:v.arrowTypeStart=`arrow_circle`;case`arrow_circle`:v.arrowTypeEnd=`arrow_circle`;break}let y=``,b=``;switch(n.stroke){case`normal`:y=`fill:none;`,c!==void 0&&(y=c),u!==void 0&&(b=u),v.thickness=`normal`,v.pattern=`solid`;break;case`dotted`:v.thickness=`normal`,v.pattern=`dotted`,v.style=`fill:none;stroke-width:2px;stroke-dasharray:3;`;break;case`thick`:v.thickness=`thick`,v.pattern=`solid`,v.style=`stroke-width: 3.5px;fill:none;`;break;case`invisible`:v.thickness=`invisible`,v.pattern=`solid`,v.style=`stroke-width: 0;fill:none;`;break}if(n.style!==void 0){let e=l(n.style);y=e.style,b=e.labelStyle}v.style=v.style+=y,v.labelStyle=v.labelStyle+=b,n.interpolate===void 0?e.defaultInterpolate===void 0?v.curve=_(F.curve,a):v.curve=_(e.defaultInterpolate,a):v.curve=_(n.interpolate,a),n.text===void 0?n.style!==void 0&&(v.arrowheadStyle=`fill: #333`):(v.arrowheadStyle=`fill: #333`,v.labelpos=`c`),v.labelType=n.labelType,v.label=await f(n.text.replace(g.lineBreakRegex,`
`),s()),n.style===void 0&&(v.style=v.style||`stroke: #333; stroke-width: 1.5px;fill:none;`),v.labelStyle=v.labelStyle.replace(`color:`,`fill:`),v.id=p,v.classes=`flowchart-link `+m+` `+h,t.setEdge(n.start,n.end,v,r)}},z=function(e,t){return t.db.getClasses()},B=async function(e,n,r,a){i.info(`Drawing flowchart`);let o=a.db.getDirection();o===void 0&&(o=`TD`);let{securityLevel:l,flowchart:u}=s(),f=u.nodeSpacing||50,p=u.rankSpacing||50,m;l===`sandbox`&&(m=c(`#i`+n));let h=c(l===`sandbox`?m.nodes()[0].contentDocument.body:`body`),g=l===`sandbox`?m.nodes()[0].contentDocument:document,_=new x({multigraph:!0,compound:!0}).setGraph({rankdir:o,nodesep:f,ranksep:p,marginx:0,marginy:0}).setDefaultEdgeLabel(function(){return{}}),v,b=a.db.getSubGraphs();i.info(`Subgraphs - `,b);for(let e=b.length-1;e>=0;e--)v=b[e],i.info(`Subgraph - `,v),a.db.addVertex(v.id,{text:v.title,type:v.labelType},`group`,void 0,v.classes,v.dir);let S=a.db.getVertices(),w=a.db.getEdges();i.info(`Edges`,w);let T=0;for(T=b.length-1;T>=0;T--){v=b[T],d(`cluster`).append(`text`);for(let e=0;e<v.nodes.length;e++)i.info(`Setting up subgraphs`,v.nodes[e],v.id),_.setParent(v.nodes[e],v.id)}await L(S,_,n,h,g,a),await R(w,_);let E=h.select(`[id="${n}"]`);if(await C(h.select(`#`+n+` g`),_,[`point`,`circle`,`cross`],`flowchart`,n),t.insertTitle(E,`flowchartTitleText`,u.titleTopMargin,a.db.getDiagramTitle()),y(_,E,u.diagramPadding,u.useMaxWidth),a.db.indexNodes(`subGraph`+T),!u.htmlLabels){let e=g.querySelectorAll(`[id="`+n+`"] .edgeLabel .label`);for(let t of e){let e=t.getBBox(),n=g.createElementNS(`http://www.w3.org/2000/svg`,`rect`);n.setAttribute(`rx`,0),n.setAttribute(`ry`,0),n.setAttribute(`width`,e.width),n.setAttribute(`height`,e.height),t.insertBefore(n,t.firstChild)}}Object.keys(S).forEach(function(e){let t=S[e];if(t.link){let r=c(`#`+n+` [id="`+e+`"]`);if(r){let e=g.createElementNS(`http://www.w3.org/2000/svg`,`a`);e.setAttributeNS(`http://www.w3.org/2000/svg`,`class`,t.classes.join(` `)),e.setAttributeNS(`http://www.w3.org/2000/svg`,`href`,t.link),e.setAttributeNS(`http://www.w3.org/2000/svg`,`rel`,`noopener`),l===`sandbox`?e.setAttributeNS(`http://www.w3.org/2000/svg`,`target`,`_top`):t.linkTarget&&e.setAttributeNS(`http://www.w3.org/2000/svg`,`target`,t.linkTarget);let n=r.insert(function(){return e},`:first-child`),i=r.select(`.label-container`);i&&n.append(function(){return i.node()});let a=r.select(`.label`);a&&n.append(function(){return a.node()})}}})},V={setConf:I,addVertices:L,addEdges:R,getClasses:z,draw:B},H=(e,t)=>{let n=o;return m(n(e,`r`),n(e,`g`),n(e,`b`),t)},U=e=>`.label {
    font-family: ${e.fontFamily};
    color: ${e.nodeTextColor||e.textColor};
  }
  .cluster-label text {
    fill: ${e.titleColor};
  }
  .cluster-label span,p {
    color: ${e.titleColor};
  }

  .label text,span,p {
    fill: ${e.nodeTextColor||e.textColor};
    color: ${e.nodeTextColor||e.textColor};
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${e.mainBkg};
    stroke: ${e.nodeBorder};
    stroke-width: 1px;
  }
  .flowchart-label text {
    text-anchor: middle;
  }
  // .flowchart-label .text-outer-tspan {
  //   text-anchor: middle;
  // }
  // .flowchart-label .text-inner-tspan {
  //   text-anchor: start;
  // }

  .node .katex path {
    fill: #000;
    stroke: #000;
    stroke-width: 1px;
  }

  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  .arrowheadPath {
    fill: ${e.arrowheadColor};
  }

  .edgePath .path {
    stroke: ${e.lineColor};
    stroke-width: 2.0px;
  }

  .flowchart-link {
    stroke: ${e.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${e.edgeLabelBackground};
    rect {
      opacity: 0.5;
      background-color: ${e.edgeLabelBackground};
      fill: ${e.edgeLabelBackground};
    }
    text-align: center;
  }

  /* For html labels only */
  .labelBkg {
    background-color: ${H(e.edgeLabelBackground,.5)};
    // background-color: 
  }

  .cluster rect {
    fill: ${e.clusterBkg};
    stroke: ${e.clusterBorder};
    stroke-width: 1px;
  }

  .cluster text {
    fill: ${e.titleColor};
  }

  .cluster span,p {
    color: ${e.titleColor};
  }
  /* .cluster div {
    color: ${e.titleColor};
  } */

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: ${e.fontFamily};
    font-size: 12px;
    background: ${e.tertiaryColor};
    border: 1px solid ${e.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .flowchartTitleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${e.textColor};
  }
`,W=U}));export{P as a,A as c,T as d,N as i,E as l,W as n,k as o,G as r,O as s,V as t,M as u};