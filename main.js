import xs from 'xstream'
import Cycle from '@cycle/xstream-run';
import {div, label, button, input, hr, ul, li, a, makeDOMDriver} from '@cycle/dom';
import {makeRouterDriver} from 'cyclic-router';
import {createHistory} from 'history';
import Immutable from 'immutable'

export function noop() {}
export const noopListener = {
  next: noop,
  error: noop,
  complete: noop
}


function rootIntent(sources) {
  const page1$ = sources.DOM.select(`.toPage1`).events(`click`).mapTo(`/page1`)
  const page2$ = sources.DOM.select(`.toPage2`).events(`click`).mapTo(`/page2`)

  return {
    path$: xs.merge(page1$, page2$)
  }
}

function root(sources, inputs) {
  const actions = rootIntent(sources)

  return {
    DOM: inputs.injectedState$.map(state => {
      return div(`.root`, [
        div([`Root`]),
        div([`Current count: ${state.count}`]),
        div([div(`.toPage1`, [`Go to page 1`])]),
        div([div(`.toPage2`, [`Go to page 2`])])
      ])
    }),
    Router: actions.path$.map(path => ({
      action: `PUSH`,
      pathname: path,
      state: inputs.injectedState$
    }))
  }
}



function childIntent(sources) {
  const inc$ = sources.DOM.select(`.inc`).events(`click`).mapTo(1)
  const dec$ = sources.DOM.select(`.dec`).events(`click`).mapTo(-1)

  const path$ = sources.DOM.select(`.goToRoot`).events(`click`).mapTo('/')

  return {
    change$: xs.merge(inc$, dec$),
    path$
  }
}

function childReducers(actions, inputs) {
  const changeReducer$ = actions.change$.map(val => state => {
    return state.update(`count`, count => count + val)
  })

  return xs.merge(changeReducer$)
}

function childModel(actions, inputs) {
  const reducer$ = childReducers(actions, inputs)
  return inputs.injectedState$
    .map(state => {
      return reducer$.fold((acc, reducer) => reducer(acc), Immutable.Map(state))
    })
    .flatten()
    .map(x => x.toObject())
    .remember()
}

function child(sources, inputs) {
  const actions = childIntent(sources)
  const state$ = childModel(actions, inputs)
  actions.path$.addListener(noopListener)
  return {
    DOM: inputs.props$.map(props => state$.map(state => div(`.child`, [
      div([`${props.title}`]),
      div([`Current count: ${state.count}`]),
      button(`.inc`, [`+`]),
      button(`.dec`, [`-`]),
      div([div(`.goToRoot`, [`Back to root`])])
    ]))).flatten(),
    Router: actions.path$.map(path => state$.map(state =>({
      action: `PUSH`,
      pathname: path,
      state: xs.of(state)
    }))).flatten()
  }
}

function main(sources) {

  const routes = {
    '/': (state$) => root(sources, {injectedState$: state$ || xs.of({count: 0})}),
    '/page1': (state$) => {
      return child(sources, {props$: xs.of({title: `Page 1`}), injectedState$: state$})
    },
    '/page2': (state$) => {
      return child(sources, {props$: xs.of({title: `Page 2`}), injectedState$: state$})
    }
  }

  const component$ = sources.Router.define(routes)
      .drop(1)
      .map(route => {
        return route.value(route.location.state)
      })
      .remember()

	return {
		DOM: component$
			.map(x => x.DOM)
			.flatten(),
    Router: component$.map(x => x.Router).flatten().startWith({
      action: `REPLACE`,
      pathname: `/`,
      state: xs.of({count: 0})
    })
	}
}

const drivers = {
	DOM: makeDOMDriver('#app'),
	Router: makeRouterDriver(createHistory()),
};

Cycle.run(main, drivers);
