
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    function create_animation(node, from, fn, params) {
        if (!from)
            return noop;
        const to = node.getBoundingClientRect();
        if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
            return noop;
        const { delay = 0, duration = 300, easing = identity, 
        // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
        start: start_time = now() + delay, 
        // @ts-ignore todo:
        end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
        let running = true;
        let started = false;
        let name;
        function start() {
            if (css) {
                name = create_rule(node, 0, 1, duration, delay, easing, css);
            }
            if (!delay) {
                started = true;
            }
        }
        function stop() {
            if (css)
                delete_rule(node, name);
            running = false;
        }
        loop(now => {
            if (!started && now >= start_time) {
                started = true;
            }
            if (started && now >= end) {
                tick(1, 0);
                stop();
            }
            if (!running) {
                return false;
            }
            if (started) {
                const p = now - start_time;
                const t = 0 + 1 * easing(p / duration);
                tick(t, 1 - t);
            }
            return true;
        });
        start();
        tick(0, 1);
        return stop;
    }
    function fix_position(node) {
        const style = getComputedStyle(node);
        if (style.position !== 'absolute' && style.position !== 'fixed') {
            const { width, height } = style;
            const a = node.getBoundingClientRect();
            node.style.position = 'absolute';
            node.style.width = width;
            node.style.height = height;
            add_transform(node, a);
        }
    }
    function add_transform(node, a) {
        const b = node.getBoundingClientRect();
        if (a.left !== b.left || a.top !== b.top) {
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;
            node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function fix_and_outro_and_destroy_block(block, lookup) {
        block.f();
        outro_and_destroy_block(block, lookup);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error(`Cannot have duplicate keys in a keyed each`);
            }
            keys.add(key);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }
    function quintOut(t) {
        return --t * t * t * t * t + 1;
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation. All rights reserved.
    Licensed under the Apache License, Version 2.0 (the "License"); you may not use
    this file except in compliance with the License. You may obtain a copy of the
    License at http://www.apache.org/licenses/LICENSE-2.0

    THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
    WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
    MERCHANTABLITY OR NON-INFRINGEMENT.

    See the Apache Version 2.0 License for specific language governing permissions
    and limitations under the License.
    ***************************************************************************** */

    function __rest(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }
    function crossfade(_a) {
        var { fallback } = _a, defaults = __rest(_a, ["fallback"]);
        const to_receive = new Map();
        const to_send = new Map();
        function crossfade(from, node, params) {
            const { delay = 0, duration = d => Math.sqrt(d) * 30, easing = cubicOut } = assign(assign({}, defaults), params);
            const to = node.getBoundingClientRect();
            const dx = from.left - to.left;
            const dy = from.top - to.top;
            const dw = from.width / to.width;
            const dh = from.height / to.height;
            const d = Math.sqrt(dx * dx + dy * dy);
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;
            const opacity = +style.opacity;
            return {
                delay,
                duration: is_function(duration) ? duration(d) : duration,
                easing,
                css: (t, u) => `
				opacity: ${t * opacity};
				transform-origin: top left;
				transform: ${transform} translate(${u * dx}px,${u * dy}px) scale(${t + (1 - t) * dw}, ${t + (1 - t) * dh});
			`
            };
        }
        function transition(items, counterparts, intro) {
            return (node, params) => {
                items.set(params.key, {
                    rect: node.getBoundingClientRect()
                });
                return () => {
                    if (counterparts.has(params.key)) {
                        const { rect } = counterparts.get(params.key);
                        counterparts.delete(params.key);
                        return crossfade(rect, node, params);
                    }
                    // if the node is disappearing altogether
                    // (i.e. wasn't claimed by the other list)
                    // then we need to supply an outro
                    items.delete(params.key);
                    return fallback && fallback(node, params, intro);
                };
            };
        }
        return [
            transition(to_send, to_receive, false),
            transition(to_receive, to_send, true)
        ];
    }

    function flip(node, animation, params) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        const scaleX = animation.from.width / node.clientWidth;
        const scaleY = animation.from.height / node.clientHeight;
        const dx = (animation.from.left - animation.to.left) / scaleX;
        const dy = (animation.from.top - animation.to.top) / scaleY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
        return {
            delay,
            duration: is_function(duration) ? duration(d) : duration,
            easing,
            css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
        };
    }

    /* src/App.svelte generated by Svelte v3.23.0 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	return child_ctx;
    }

    // (87:6) {#each todos.filter(e=> !e.done) as item (item.id)}
    function create_each_block_1(key_1, ctx) {
    	let label;
    	let input;
    	let t0;
    	let span;
    	let t1_value = /*item*/ ctx[16].description + "";
    	let t1;
    	let t2;
    	let button;
    	let label_intro;
    	let label_outro;
    	let rect;
    	let stop_animation = noop;
    	let current;
    	let mounted;
    	let dispose;

    	function change_handler(...args) {
    		return /*change_handler*/ ctx[10](/*item*/ ctx[16], ...args);
    	}

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[11](/*item*/ ctx[16], ...args);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			button = element("button");
    			button.textContent = "remove";
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "class", "svelte-1n3dt7b");
    			add_location(input, file, 92, 8, 2526);
    			add_location(span, file, 93, 8, 2591);
    			attr_dev(button, "class", "svelte-1n3dt7b");
    			add_location(button, file, 94, 8, 2631);
    			attr_dev(label, "class", "text-left svelte-1n3dt7b");
    			add_location(label, file, 87, 7, 2367);
    			this.first = label;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			append_dev(label, t0);
    			append_dev(label, span);
    			append_dev(span, t1);
    			append_dev(label, t2);
    			append_dev(label, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", change_handler, false, false, false),
    					listen_dev(button, "click", click_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*todos*/ 2) && t1_value !== (t1_value = /*item*/ ctx[16].description + "")) set_data_dev(t1, t1_value);
    		},
    		r: function measure() {
    			rect = label.getBoundingClientRect();
    		},
    		f: function fix() {
    			fix_position(label);
    			stop_animation();
    			add_transform(label, rect);
    		},
    		a: function animate() {
    			stop_animation();
    			stop_animation = create_animation(label, rect, flip, { duration: 200 });
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (label_outro) label_outro.end(1);
    				if (!label_intro) label_intro = create_in_transition(label, /*receive*/ ctx[6], { key: /*item*/ ctx[16].id });
    				label_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (label_intro) label_intro.invalidate();
    			label_outro = create_out_transition(label, /*send*/ ctx[5], { key: /*item*/ ctx[16].id });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			if (detaching && label_outro) label_outro.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(87:6) {#each todos.filter(e=> !e.done) as item (item.id)}",
    		ctx
    	});

    	return block;
    }

    // (110:6) {#each todos.filter(e=> e.done) as item (item.id)}
    function create_each_block(key_1, ctx) {
    	let label;
    	let input;
    	let t0;
    	let span;
    	let t1_value = /*item*/ ctx[16].description + "";
    	let t1;
    	let t2;
    	let button;
    	let label_intro;
    	let label_outro;
    	let rect;
    	let stop_animation = noop;
    	let current;
    	let mounted;
    	let dispose;

    	function change_handler_1(...args) {
    		return /*change_handler_1*/ ctx[13](/*item*/ ctx[16], ...args);
    	}

    	function click_handler_2(...args) {
    		return /*click_handler_2*/ ctx[14](/*item*/ ctx[16], ...args);
    	}

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			button = element("button");
    			button.textContent = "remove";
    			attr_dev(input, "type", "checkbox");
    			input.checked = true;
    			attr_dev(input, "class", "svelte-1n3dt7b");
    			add_location(input, file, 115, 8, 3292);
    			add_location(span, file, 116, 8, 3366);
    			attr_dev(button, "class", "svelte-1n3dt7b");
    			add_location(button, file, 117, 8, 3406);
    			attr_dev(label, "class", "text-left done svelte-1n3dt7b");
    			add_location(label, file, 110, 7, 3127);
    			this.first = label;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			append_dev(label, t0);
    			append_dev(label, span);
    			append_dev(span, t1);
    			append_dev(label, t2);
    			append_dev(label, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", change_handler_1, false, false, false),
    					listen_dev(button, "click", click_handler_2, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*todos*/ 2) && t1_value !== (t1_value = /*item*/ ctx[16].description + "")) set_data_dev(t1, t1_value);
    		},
    		r: function measure() {
    			rect = label.getBoundingClientRect();
    		},
    		f: function fix() {
    			fix_position(label);
    			stop_animation();
    			add_transform(label, rect);
    		},
    		a: function animate() {
    			stop_animation();
    			stop_animation = create_animation(label, rect, flip, { duration: 200 });
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (label_outro) label_outro.end(1);
    				if (!label_intro) label_intro = create_in_transition(label, /*receive*/ ctx[6], { key: /*item*/ ctx[16].id });
    				label_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (label_intro) label_intro.invalidate();
    			label_outro = create_out_transition(label, /*send*/ ctx[5], { key: /*item*/ ctx[16].id });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			if (detaching && label_outro) label_outro.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(110:6) {#each todos.filter(e=> e.done) as item (item.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let div9;
    	let div1;
    	let div0;
    	let input;
    	let t2;
    	let div8;
    	let div4;
    	let div3;
    	let div2;
    	let h20;
    	let t4;
    	let each_blocks_1 = [];
    	let each0_lookup = new Map();
    	let t5;
    	let button0;
    	let t6;
    	let button0_disabled_value;
    	let t7;
    	let div7;
    	let div6;
    	let div5;
    	let h21;
    	let t9;
    	let each_blocks = [];
    	let each1_lookup = new Map();
    	let t10;
    	let button1;
    	let t11;
    	let button1_disabled_value;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*todos*/ ctx[1].filter(func);
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*item*/ ctx[16].id;
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each0_lookup.set(key, each_blocks_1[i] = create_each_block_1(key, child_ctx));
    	}

    	let each_value = /*todos*/ ctx[1].filter(func_2);
    	validate_each_argument(each_value);
    	const get_key_1 = ctx => /*item*/ ctx[16].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key_1);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key_1(child_ctx);
    		each1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			div9 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			input = element("input");
    			t2 = space();
    			div8 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			h20 = element("h2");
    			h20.textContent = "代辦事項";
    			t4 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t5 = space();
    			button0 = element("button");
    			t6 = text("全部完成");
    			t7 = space();
    			div7 = element("div");
    			div6 = element("div");
    			div5 = element("div");
    			h21 = element("h2");
    			h21.textContent = "已完成";
    			t9 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t10 = space();
    			button1 = element("button");
    			t11 = text("全部清除");
    			attr_dev(h1, "class", "font-weight-normal svelte-1n3dt7b");
    			add_location(h1, file, 72, 1, 1893);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "w-100 shadow");
    			attr_dev(input, "placeholder", "有什麼需要紀錄呢？");
    			add_location(input, file, 77, 4, 2015);
    			attr_dev(div0, "class", "col-12");
    			add_location(div0, file, 76, 3, 1990);
    			attr_dev(div1, "class", "row mb-3");
    			add_location(div1, file, 75, 2, 1964);
    			attr_dev(h20, "class", "svelte-1n3dt7b");
    			add_location(h20, file, 85, 6, 2288);
    			attr_dev(button0, "type", "button");
    			attr_dev(button0, "class", "btn btn-outline-secondary btn-block btn-sm");
    			button0.disabled = button0_disabled_value = /*todos*/ ctx[1].filter(func_1).length == 0;
    			add_location(button0, file, 97, 6, 2723);
    			attr_dev(div2, "class", "card-body");
    			add_location(div2, file, 84, 5, 2258);
    			attr_dev(div3, "class", "card shadow");
    			add_location(div3, file, 83, 4, 2227);
    			attr_dev(div4, "class", "col-12 col-md-6 mb-3 mb-md-0");
    			add_location(div4, file, 81, 3, 2175);
    			attr_dev(h21, "class", "svelte-1n3dt7b");
    			add_location(h21, file, 108, 6, 3050);
    			attr_dev(button1, "type", "button");
    			attr_dev(button1, "class", "btn btn-outline-secondary btn-block btn-sm");
    			button1.disabled = button1_disabled_value = /*todos*/ ctx[1].filter(func_3).length == 0;
    			add_location(button1, file, 120, 6, 3498);
    			attr_dev(div5, "class", "card-body");
    			add_location(div5, file, 107, 5, 3020);
    			attr_dev(div6, "class", "card shadow");
    			add_location(div6, file, 106, 4, 2989);
    			attr_dev(div7, "class", "col-12 col-md-6");
    			add_location(div7, file, 105, 3, 2955);
    			attr_dev(div8, "class", "row");
    			add_location(div8, file, 80, 2, 2154);
    			attr_dev(div9, "class", "container");
    			add_location(div9, file, 74, 1, 1938);
    			attr_dev(main, "class", "svelte-1n3dt7b");
    			add_location(main, file, 71, 0, 1885);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(main, t1);
    			append_dev(main, div9);
    			append_dev(div9, div1);
    			append_dev(div1, div0);
    			append_dev(div0, input);
    			append_dev(div9, t2);
    			append_dev(div9, div8);
    			append_dev(div8, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, h20);
    			append_dev(div2, t4);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div2, null);
    			}

    			append_dev(div2, t5);
    			append_dev(div2, button0);
    			append_dev(button0, t6);
    			append_dev(div8, t7);
    			append_dev(div8, div7);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, h21);
    			append_dev(div5, t9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div5, null);
    			}

    			append_dev(div5, t10);
    			append_dev(div5, button1);
    			append_dev(button1, t11);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "keydown", /*keydown_handler*/ ctx[9], false, false, false),
    					listen_dev(button0, "click", /*click_handler_1*/ ctx[12], false, false, false),
    					listen_dev(button1, "click", /*click_handler_3*/ ctx[15], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (dirty & /*remove, todos, mark*/ 26) {
    				const each_value_1 = /*todos*/ ctx[1].filter(func);
    				validate_each_argument(each_value_1);
    				group_outros();
    				for (let i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].r();
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);
    				each_blocks_1 = update_keyed_each(each_blocks_1, dirty, get_key, 1, ctx, each_value_1, each0_lookup, div2, fix_and_outro_and_destroy_block, create_each_block_1, t5, get_each_context_1);
    				for (let i = 0; i < each_blocks_1.length; i += 1) each_blocks_1[i].a();
    				check_outros();
    			}

    			if (!current || dirty & /*todos*/ 2 && button0_disabled_value !== (button0_disabled_value = /*todos*/ ctx[1].filter(func_1).length == 0)) {
    				prop_dev(button0, "disabled", button0_disabled_value);
    			}

    			if (dirty & /*remove, todos, mark*/ 26) {
    				const each_value = /*todos*/ ctx[1].filter(func_2);
    				validate_each_argument(each_value);
    				group_outros();
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
    				validate_each_keys(ctx, each_value, get_each_context, get_key_1);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key_1, 1, ctx, each_value, each1_lookup, div5, fix_and_outro_and_destroy_block, create_each_block, t10, get_each_context);
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
    				check_outros();
    			}

    			if (!current || dirty & /*todos*/ 2 && button1_disabled_value !== (button1_disabled_value = /*todos*/ ctx[1].filter(func_3).length == 0)) {
    				prop_dev(button1, "disabled", button1_disabled_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].d();
    			}

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = e => !e.done;
    const func_1 = e => !e.done;
    const func_2 = e => e.done;
    const func_3 = e => e.done;

    function instance($$self, $$props, $$invalidate) {
    	let { name } = $$props;

    	let todos = localStorage.getItem("todos")
    	? JSON.parse(localStorage.getItem("todos"))
    	: [];

    	function add(e) {
    		if (!e.value) return;

    		const todo = {
    			id: Date.now(),
    			done: false,
    			description: e.value
    		};

    		$$invalidate(1, todos = [...todos, todo]);
    		localStorage.setItem("todos", JSON.stringify(todos));
    		e.value = "";
    	}

    	function mark(todo, done) {
    		todo.done = done;
    		remove(todo);
    		$$invalidate(1, todos = todos.concat(todo));
    		localStorage.setItem("todos", JSON.stringify(todos));
    	}

    	function remove(todo) {
    		$$invalidate(1, todos = todos.filter(t => t !== todo));
    		localStorage.setItem("todos", JSON.stringify(todos));
    	}

    	// 補間動畫
    	const [send, receive] = crossfade({
    		// 特殊函數，必定創建send, receive
    		duration: d => Math.sqrt(d * 200),
    		fallback(node, params) {
    			//過度設定
    			const style = getComputedStyle(node);

    			const transform = style.transform === "none" ? "" : style.transform;

    			return {
    				duration: 600, // 過度時間
    				easing: quintOut, // 由 import 來使用 https://svelte.dev/docs#svelte_easing
    				css: t => `
					transform: ${transform} scale(${t});
					opcity: ${t}
				`, // 過度動畫樣式（t 為開始，u 為結束）
    				
    			};
    		}
    	});

    	function allMark() {
    		let tempTodos = JSON.parse(JSON.stringify(todos.filter(e => !e.done)));
    		tempTodos.map(e => e.done = true);
    		let tempDoneTodos = JSON.parse(JSON.stringify(todos.filter(e => e.done)));
    		let newTodos = [...tempDoneTodos, ...tempTodos];
    		$$invalidate(1, todos = newTodos);
    		localStorage.setItem("todos", JSON.stringify(todos));
    	}

    	function delDone() {
    		let tempTodos = JSON.parse(JSON.stringify(todos.filter(e => !e.done)));
    		$$invalidate(1, todos = tempTodos);
    		localStorage.setItem("todos", JSON.stringify(todos));
    	}

    	const writable_props = ["name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	const keydown_handler = e => e.key === "Enter" && add(e.target);
    	const change_handler = item => mark(item, true);
    	const click_handler = item => remove(item);
    	const click_handler_1 = () => allMark();
    	const change_handler_1 = item => mark(item, false);
    	const click_handler_2 = item => remove(item);
    	const click_handler_3 = () => delDone();

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		quintOut,
    		crossfade,
    		flip,
    		name,
    		todos,
    		add,
    		mark,
    		remove,
    		send,
    		receive,
    		allMark,
    		delDone
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("todos" in $$props) $$invalidate(1, todos = $$props.todos);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		todos,
    		add,
    		mark,
    		remove,
    		send,
    		receive,
    		allMark,
    		delDone,
    		keydown_handler,
    		change_handler,
    		click_handler,
    		click_handler_1,
    		change_handler_1,
    		click_handler_2,
    		click_handler_3
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'todo list'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
