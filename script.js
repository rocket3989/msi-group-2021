// http://esports-assets.s3.amazonaws.com/production/files/rules/2017-World-Championship-Rules-v-17-3.pdf
// https://lol.fandom.com/wiki/Archive:Official_Rulebooks/Riot/MSI/2021
var byGroup
var colorChoice = 0
var staticPick = false;
var ƒ = d3.f
// console.clear()
function readFile(){
    d3.loadData('annotations.json', 'matches.tsv', function(err, res){
        d3.selectAll('.group-header').st({opacity: 1})
    
        annotations = res[0]
        matches = res[1]
    
        teams2wins = {}
    
        matches.forEach(function(d, i){
            d.winner = +d.winner
            if( i < 18 || !staticPick){
                d.wName = d['t' + d.winner]
                d.actualWinner = !(d.winner === 0) ? d.winner : 3
            }
            d.complete = i < 18
            d.allTeams = d.t1 + '-' + d.t2
            if (!teams2wins[d.t1]) teams2wins[d.t1] = 0
            if (!teams2wins[d.t2]) teams2wins[d.t2] = 0
            if (d.date < "05-09") teams2wins[d.wName]++     //make sure to change key each year
        })
        console.log(matches)
        byGroup = d3.nestBy(matches, ƒ('group'))
        reDraw();
    })
}
readFile()

function static(){
    staticPick = !staticPick
    readFile();
}

function changeColor(){
    colorChoice ^= 1;
    reDraw();
}

function changeSeed(){
    colorChoice ^= 2;
    reDraw();
}

function reDraw(){
    byGroup.forEach(drawGroup)
}



function scoreMatches(matches){
    var teams = d3.nestBy(matches, ƒ('t1')).map(function(d){
        return {name: d.key, w: 0}
    })
    var nameToTeam = {}
    teams.forEach(function(d){ nameToTeam[d.name] = d })
    // console.log(nameToTeam);
    // console.log(teams)
    // console.log(matches)

    matches.forEach(addMatchWins)

    teams.forEach(function(d){ 
        d.wins = d.w 
        d.w = 0
    })

    d3.nestBy(teams, ƒ('wins')).forEach(function(d){
        if (d.length == 1 || d.length == 4) return


        var tiedTeams = d.map(ƒ('name')).join('-')
        var tiedMatches = matches
        .filter(function(d){
            return ~tiedTeams.indexOf(d.t1) && ~tiedTeams.indexOf(d.t2) })
        tiedMatches.forEach(addMatchWins)

        // in 3-way tie, only head2head winning record gets out of tiebreaker
        if (d.length != 3) return
        // console.log(d.length, d.map(d => d.w).join(' '))
        // console.log(d.length, JSON.parse(JSON.stringify(d)))
        d.forEach(function(d){ d.w = d.w > 2 ? d.w : 0 })
    })


    var advanceSlots = 2
    
    d3.nestBy(teams, function(d){ return d.w + d.wins*10 })
        .sort(d3.descendingKey('key'))
        .forEach(function(d){
        if (d.length <= advanceSlots){
            d.forEach(function(d){ d.advance = 't'})
            if(advanceSlots == 2){
                if(d.length == 2){ //check for tied first place
                    against = matches.filter(match => {return match.allTeams == d[0].name + '-' + d[1].name 
                                                           || match.allTeams == d[1].name + '-' + d[0].name})
                    if(against[0].actualWinner == against[1].actualWinner){
                        d.forEach(function(d){ if (d.name == against[0].actualWinner) d.advance = 'u'})
                    }
                }
                else
                    d.forEach(function(d){ d.advance = 'u'})
            }
        } else if (advanceSlots > 0){
            d.forEach(function(d){ d.advance = 'm'})
        } else{
            d.forEach(function(d){ d.advance = 'f' })
            if(d.length == 2){ //check for tied last place
                against = matches.filter(match => {return match.allTeams == d[0].name + '-' + d[1].name 
                                                       || match.allTeams == d[1].name + '-' + d[0].name})
                if(against[0].actualWinner == against[1].actualWinner){
                    d.forEach(function(d){ if (d.name != against[0].actualWinner) d.advance = 'e'})
                }
            }
            if(advanceSlots == - 1){
                d[0].advance = 'e'
            }
        }
        advanceSlots -= d.length
        })

    function addMatchWins(d){ nameToTeam[d['t' + d.winner]].w++ }


    return teams
}

function drawGroup(gMatches){
    var sel = d3.select('#group-' + gMatches.key.toLowerCase()).html('')
    
    var complete = gMatches.filter(d => d.complete)
    var incomplete = gMatches.filter(function(d){ return !d.complete })
    console.log(complete, incomplete)

    scenarios = d3.range(64).map(function(i){
        incomplete.forEach(function(d, j){
        d.winner = (i >> j) % 2 ? 1 : 2 
        d.wName = d['t' + d.winner]
        })

        return {
        str: incomplete.map(ƒ('winner')).join(''),
        teams: scoreMatches(gMatches), 
        incomplete: JSON.parse(JSON.stringify(incomplete))}    
    })

    var teams = d3.nestBy(gMatches, ƒ('t1')).map(function(d){
        return {name: d.key, w: 0, actualWins: teams2wins[d.key]}
    }).sort(d3.descendingKey('actualWins'))

    sel.appendMany('div.team', teams)
        .each(function(d){ 
            if (["RNG", "PGG", "UOL"].includes(d.name)) {
                drawResults3(d3.select(this), scenarios, d.name, complete, incomplete) 

            }
            else{
                drawResults(d3.select(this), scenarios, d.name, complete, incomplete) 

            }
        
        })

    incomplete.forEach(function(d){ d.clicked = (+d.actualWinner || 3) - 1 })
    var gameSel = sel.append('div.matches')
        .st({marginTop: 50})
        .appendMany('div.game', incomplete)
        .on('click', function(d){
        d.clicked = (d.clicked + 1) % 3

        d3.select(this).selectAll('.teamabv')
            .classed('won', function(e, i){ return i + 1 == d.clicked })
        d3.select(this).classed('active', d.clicked)

        var str = incomplete.map(ƒ('clicked')).join('')
        sel.selectAll('circle.scenario').classed('hidden', function(d){
            return d.incomplete.some(function(d, i){
            return str[i] != '0' && str[i] != d.winner
            })
        })
        })
    gameSel.append('span.teamabv').text(ƒ('t1'))
    gameSel.append('span').text(' v. ')
    gameSel.append('span.teamabv').text(ƒ('t2'))
    gameSel.each(function(d){ d3.select(this).on('click').call(this, d) })
}


function drawResults(sel, scenarios, name, complete, incomplete){
    scenarios.forEach(function(d){
        d.team = d.teams.filter(function(d){ return d.name == name })[0]
        d.wins = d.team.wins

        d.playedIn = d.incomplete.filter(function(d){
        d.currentWon = name == d.wName
        return name == d.t1 || name == d.t2 })
        d.recordStr = d.playedIn.map(function(d){ return +d.currentWon }).join('')
    })

    var against = []
    scenarios[0].playedIn.forEach(function(d){
        var otherTeam = name == d.t1 ? d.t2 : d.t1
        against.push(otherTeam)
    })

    var completeIn = complete.filter(function(d){
        d.currentWon = name == d.wName
        d.otherTeam = name == d.t1 ? d.t2 : d.t1
        return name == d.t1 || name == d.t2 })

    var pBeat = completeIn.filter(ƒ('currentWon'))
    var pLost = completeIn.filter(function(d){ return !d.currentWon })

    var pStr = 'Lost to ' 
    pStr += pLost.map(ƒ('otherTeam')).join(' and ')

    if (pBeat.length){
        pStr += ' // Beat ' + pBeat.map(ƒ('otherTeam')).join(' and ')
    } else{
        pStr = pStr.replace(' and ', ', ')
    }
    if (!pLost.length) pStr = pStr.replace('Lost to  //', '').replace(' and ', ', ')
    // pStr += ' previously'

    var byWins = d3.nestBy(scenarios, ƒ('wins'))
    byWins.forEach(function(d, i){
        d.sort(d3.descendingKey(ƒ('team', 'advance')))
        d.byRecordStr = _.sortBy(d3.nestBy(d, ƒ('recordStr')), 'key')
        if (i == 1) d.byRecordStr.reverse()
    })
    
    var width = 315, height = 300
    var svg = sel.append('svg').at({width, height}).st({margin: 20})
    .append('g').translate([0, 100])
    var gSel = d3.select(sel.node().parentNode)
    
    var swoopySel = svg.append('g.annotations')

    svg.append('text').text(name)
        .translate([10*3.5 + 100, -60]).at({textAnchor: 'middle', fontSize: 20})

    svg.append('text').text(pStr)
        .translate([10*3.5 + 100, -45]).at({textAnchor: 'middle', fontSize: 12, fill: '#888'})
        
        
    var winsSel = svg.appendMany('g', byWins.sort(d3.descendingKey('key')))
        .translate(function(d, i){ return [0, i*80 + (i == 3 ? -15*2 : i > 0 ? -8 : 0)] })


    winsSel.append('text')
        .text(function(d, i){ return i == 1 ? 'Only Lose To...' : i == 2 ? 'Only Beat...' : '' })
        .at({textAnchor: 'middle', x: 10*3.5 + 100, y: -30, fill: '#888', fontSize: 12})


    var recordSel = winsSel.appendMany('g', ƒ('byRecordStr'))
        .translate(function(d, i){ return [d.key == '000' || d.key == '111' ? 100 : i*100, 0] })

    

    recordSel.append('text')
        .text(function(d){
        var s
        if (d.key == '111') s = 'Win Next Three'
        if (d.key == '000') s = 'Lose Next Three'
        if (d.key == '001') s = against[2] 
        if (d.key == '010') s = against[1] 
        if (d.key == '100') s = against[0] 
        if (d.key == '011') s = against[0] 
        if (d.key == '101') s = against[1] 
        if (d.key == '110') s = against[2] 
        return s
        })
        .at({textAnchor: 'middle', x: 10*3.5, y: -10})
    
    recordSel.appendMany('circle.scenario', ƒ())
        .at({r: 5, fill: ƒ('team', color[colorChoice]), cx: function(d, i){return i*10} })
        .call(d3.attachTooltip)
        .on('mouseout', function(){gSel.selectAll('circle.scenario').classed('active', false).at('r', 5) })
        .on('mouseover', function(d){
        gSel.selectAll('circle.scenario')
            .classed('active', 0)
            .attr('r', 5)
            .filter(function(e){ return d.str == e.str })
            .classed('active', 1)
            .attr('r', 8)
            .raise()

        var tt = d3.select('.tooltip').html('')
        var gameSel = tt.appendMany('div.game', incomplete)
        gameSel.append('span').text(ƒ('t1')).classed('won', function(e, i){ return d.str[i] == 1 })
        gameSel.append('span').text(' v. ')
        gameSel.append('span').text(ƒ('t2')).classed('won', function(e, i){ return d.str[i] == 2 })

        var byAdvanceSel = tt.appendMany('div.advance', d3.nestBy(d.teams, ƒ('advance')).sort(d3.descendingKey('key')))
            .text(function(d){
            return d.map(ƒ('name')).join(' and ') + {u:' first seed',t: ' advance', m: ' tie', f: (d.length > 1 ? ' are' : ' is') + ' eliminated', e:' last place'}[d.key]
            })
        })
        
        .on('click', function(d){
            current = []
            blank = true
            d3.selectAll('.matches > .game').each(function(e, i){
                if (e.group == d.incomplete[0].group){
                    current.push(e.clicked) 
                    if (e.clicked != 0) blank = false
                }
            })
            reset = !d3.select(this).classed('hidden') && !blank
            d3.selectAll('.matches > .game').each(function(e, i){
                if (e.group == d.incomplete[0].group){
                    if(reset) e.clicked = -1
                    else if(blank)
                        e.clicked = parseInt(d.str[i % 6]) - 1
                    else if(parseInt(d.str[i % 6]) != current[i % 6])
                        e.clicked = -1
                    else e.clicked--
                    d3.select(this).dispatch("click")
                }
            })
        })

    var swoopy = d3.swoopyDrag()
        .draggable(0)
        .x(function(){ return 0 })
        .y(function(){ return 0 })
        .annotations(annotations.filter(function(d){ return d.team == name }))

    swoopySel.call(swoopy)
    swoopySel.selectAll('path').attr('marker-end', 'url(#arrow)')
    swoopySel.selectAll('text')
        .each(function(d){
            d3.select(this)
                .text('')                        //clear existing text
                .tspans(d3.wordwrap(d.text, d.lw || 5)) //wrap after 20 char
        })  

}

function drawResults3(sel, scenarios, name, complete, incomplete){
    console.log(name)
    scenarios.forEach(function(d){
        d.team = d.teams.filter(function(d){ return d.name == name })[0]
        d.wins = d.team.wins
        console.log(name, d.team.name)

        d.playedIn = d.incomplete.filter(function(d){
        d.currentWon = name == d.wName
        return name == d.t1 || name == d.t2 })
        d.recordStr = d.playedIn.map(function(d){ return +d.currentWon }).join('')
        d.record1 = d.recordStr[0] + d.recordStr[2]
        d.record2 = d.recordStr[1] + d.recordStr[3]
        
    })
    scenarios.forEach(function(d){
        console.log(d.team.name)
    })
    console.log(scenarios)

    var against = []
    scenarios[0].playedIn.forEach(function(d){
        var otherTeam = name == d.t1 ? d.t2 : d.t1
        against.push(otherTeam)
    })

    var completeIn = complete.filter(function(d){
        d.currentWon = name == d.wName
        d.otherTeam = name == d.t1 ? d.t2 : d.t1
        return name == d.t1 || name == d.t2 })

    var pBeat = completeIn.filter(ƒ('currentWon'))
    var pLost = completeIn.filter(function(d){ return !d.currentWon })

    var pStr = 'Lost to ' 
    pStr += pLost.map(ƒ('otherTeam')).join(' and ')

    if (pBeat.length){
        pStr += ' // Beat ' + pBeat.map(ƒ('otherTeam')).join(' and ')
    } else{
        pStr = pStr.replace(' and ', ', ')
    }
    if (!pLost.length) pStr = pStr.replace('Lost to  //', '').replace(' and ', ', ')
    // pStr += ' previously'

    var byRecord1 = d3.nestBy(scenarios, ƒ('record1'))
    byRecord1.forEach(function(d, i){
        d.sort(d3.descendingKey(ƒ('team', 'advance')))
        d.byRecord2 = _.sortBy(d3.nestBy(d, ƒ('record2')), 'key')
        d.byRecord2.reverse()
    })

    // var byRecordStr = d3.nestBy(scenarios, ƒ('recordStr'))
    console.log(against)
    // console.log(completeIn)
    // console.log(byRecordStr)
    sel.st({marginTop: -30})
    if (name == 'RNG')
        sel.st({margin:'0px auto', display:'block', width:300, marginBottom:0, marginTop:70})

    
    var width = 300 , height = 300
    var svg = sel.append('svg').at({width, height})
    .append('g').translate([0, 0])
    var gSel = d3.select(sel.node().parentNode)
    
    var swoopySel = svg.append('g.annotations')

    thing = svg.append('g').at({transform:'rotate (-45)'})
    
    thing.append('text').text(name)
        .at({transform:'translate(15, -50)'}).at({textAnchor: 'middle', fontSize: 24})

    curr = svg.append('g').translate([90, -60])
    
    curr
    .append('text').text('Record vs '+ against[1])
        .at({textAnchor: 'middle', fontSize: 16,fill: '#555'})
    
    curr.append('text').text('WW')
        .translate([-80, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})

    curr.append('text').text('WL')
        .translate([-20, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})
    
    curr.append('text').text('LW')
        .translate([40, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})

    curr.append('text').text('LL')
        .translate([100, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})
        



    curr = svg.append('g').at({transform:'translate(-40, 90) rotate (-90)'})
    
    
    curr.append('text').text('Record vs '+against[0]).at({textAnchor: 'middle', fontSize: 16,fill: '#555'})
    
    curr.append('text').text('LL')
        .translate([-80, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})

    curr.append('text').text('LW')
        .translate([-20, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})
    
    curr.append('text').text('WL')
        .translate([40, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})

    curr.append('text').text('WW')
        .translate([100, 20]).at({textAnchor: 'middle', fontSize: 14, fill: '#888'})
    

    svg.at({transform:'translate(140, 0) rotate (45)', transformOrgin:'center'})
    // svg.append('text').text(pStr)
    //     .translate([10*3.5 + 100, -45]).at({textAnchor: 'middle', fontSize: 12, fill: '#888'})
        
        
    var winsSel = svg.appendMany('g', byRecord1.sort(d3.descendingKey('key')))
        .translate(function(d, i){ return [0, i*60] })
        


    // winsSel.append('text')
    //     .text(function(d, i){ return i == 1 ? 'Only Lose To...' : i == 2 ? 'Only Beat...' : '' })
    //     .at({textAnchor: 'middle', x: 10*3.5 + 100, y: -30, fill: '#888', fontSize: 12})


    var recordSel = winsSel.appendMany('g', ƒ('byRecord2'))
        .translate(function(d, i){ return [i*60, 0] })
        .append('g')
        .at({transform:'rotate (-45)'})
    

    recordSel.append('text')
        .text(function(d){
        var s
        console.log(d.key)
        if (d.key == '111') s = 'Win Next Three'
        if (d.key == '000') s = 'Lose Next Three'
        if (d.key == '001') s = against[2] 
        if (d.key == '010') s = against[1] 
        if (d.key == '100') s = against[0] 
        if (d.key == '011') s = against[0] 
        if (d.key == '101') s = against[1] 
        if (d.key == '110') s = against[2] 
        return s
        })
        .at({textAnchor: 'middle', x: 10*3.5, y: -10})
    
    recordSel.appendMany('circle.scenario', ƒ())
        .at({r: 5, fill: ƒ('team', color[colorChoice]), cx: function(d, i){return i*10} })
        .call(d3.attachTooltip)
        .on('mouseout', function(){gSel.selectAll('circle.scenario').classed('active', false).at('r', 5) })
        .on('mouseover', function(d){
        gSel.selectAll('circle.scenario')
            .classed('active', 0)
            .attr('r', 5)
            .filter(function(e){ return d.str == e.str })
            .classed('active', 1)
            .attr('r', 8)
            .raise()

        var tt = d3.select('.tooltip').html('')
        var gameSel = tt.appendMany('div.game', incomplete)
        gameSel.append('span').text(ƒ('t1')).classed('won', function(e, i){ return d.str[i] == 1 })
        gameSel.append('span').text(' v. ')
        gameSel.append('span').text(ƒ('t2')).classed('won', function(e, i){ return d.str[i] == 2 })

        var byAdvanceSel = tt.appendMany('div.advance', d3.nestBy(d.teams, ƒ('advance')).sort(d3.descendingKey('key')))
            .text(function(d){
            return d.map(ƒ('name')).join(' and ') + {u:' first seed',t: ' advance', m: ' tie', f: (d.length > 1 ? ' are' : ' is') + ' eliminated', e:' last place'}[d.key]
            })
        })
        
        .on('click', function(d){
            current = []
            blank = true
            d3.selectAll('.matches > .game').each(function(e, i){
                if (e.group == d.incomplete[0].group){
                    current.push(e.clicked) 
                    if (e.clicked != 0) blank = false
                }
            })
            reset = !d3.select(this).classed('hidden') && !blank
            d3.selectAll('.matches > .game').each(function(e, i){
                if (e.group == d.incomplete[0].group){
                    if(reset) e.clicked = -1
                    else if(blank)
                        e.clicked = parseInt(d.str[i % 6]) - 1
                    else if(parseInt(d.str[i % 6]) != current[i % 6])
                        e.clicked = -1
                    else e.clicked--
                    d3.select(this).dispatch("click")
                }
            })
        })

    var swoopy = d3.swoopyDrag()
        .draggable(1)
        .x(function(){ return 0 })
        .y(function(){ return 0 })
        .annotations(annotations.filter(function(d){ return d.team == name }))

    swoopySel.call(swoopy)
    swoopySel.selectAll('path').attr('marker-end', 'url(#arrow)')
    swoopySel.selectAll('text')
        .each(function(d){
            d3.select(this)
                .text('')                        //clear existing text
                .tspans(d3.wordwrap(d.text, d.lw || 5)) //wrap after 20 char
        })  

}
    
color = [ function color(d){ return {u:'#4CAF50',t: '#4CAF50', m: '#FF9800', f: '#f73434', e: '#f73434'}[d.advance] },
          function color(d){ return {u:'#2c7bb6',t: '#2c7bb6', m: '#dfaf90', f: '#f73434', e: '#f73434'}[d.advance] },
           function color(d){ return {u:'#36e03d',t: '#4CAF50', m: '#FF9800', f: '#f73434', e: '#b80f02'}[d.advance] },
          function color(d){ return {u:'#5aa4db',t: '#2c7bb6', m: '#dfaf90', f: '#f73434', e: '#b80f02'}[d.advance] }]

d3.select('html').selectAppend('div.tooltip').classed('tooltip-hidden', 1)

d3.select('html').selectAppend('svg.marker')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '-10 -10 20 20')
    .attr('markerWidth', 20)
    .attr('markerHeight', 20)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M-6.75,-6.75 L 0,0 L -6.75,6.75')
