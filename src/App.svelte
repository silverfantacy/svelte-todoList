<script>
	import { quintOut } from 'svelte/easing';      // 動態參數
	import { crossfade } from 'svelte/transition'; // 特殊函數
	import { flip } from 'svelte/animate';         // 未過度的元素要使用 animate https://svelte.dev/docs#svelte_animate
	
	export let name;


	let todos = localStorage.getItem('todos') ? JSON.parse(localStorage.getItem('todos')) : [];


	function add(e) {
		const todo = {
			id: Date.now(),
			done: false,
			description: e.value
		}

		todos = [...todos, todo];
		localStorage.setItem('todos', JSON.stringify(todos));
		e.value = ''
	}

	function mark(todo, done) {
		todo.done = done

		remove(todo);
		todos = todos.concat(todo);
		localStorage.setItem('todos', JSON.stringify(todos));
	}

	function remove(todo) {
		todos = todos.filter(t => t !== todo);
		localStorage.setItem('todos', JSON.stringify(todos));
	}

	// 補間動畫
	const [send, receive] = crossfade({  // 特殊函數，必定創建send, receive
		duration: d => Math.sqrt(d * 200),
		fallback(node, params) {  //過度設定
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;

			return {
				duration: 600,     // 過度時間
				easing: quintOut,  // 由 import 來使用 https://svelte.dev/docs#svelte_easing
				css: t => `
					transform: ${transform} scale(${t});
					opcity: ${t}
				`                  // 過度動畫樣式（t 為開始，u 為結束）
			}
		}
	})
</script>

<main>
	<h1 class="font-weight-normal">{name}</h1>

	<div class="container">
		<div class="row mb-3">
			<div class="col-12">
				<input type="text" class="w-100 shadow" placeholder="有什麼需要紀錄呢？" on:keydown={e => e.key === 'Enter' && add(e.target)}>
			</div>
		</div>
		<div class="row">
			<div class="col-12 col-md-6">
				
				<div class="card shadow">
					<div class="card-body">
						<h2>代辦事項</h2>
						{#each todos.filter(e=> !e.done) as item (item.id)}
							<label class="text-left"
								in:receive="{{key: item.id}}" 
								out:send="{{key: item.id}}"
								animate:flip="{{duration: 200}}"
								>
								<input type=checkbox on:change={() => mark(item, true)}>
								<span>{item.description}</span>
								<button on:click="{() => remove(item)}">remove</button>
							</label>
						{/each}
					</div>
				</div>
			</div>
			<div class="col-12 col-md-6">
				<div class="card shadow">
					<div class="card-body">
						<h2>已完成</h2>
						{#each todos.filter(e=> e.done) as item (item.id)}
							<label class="text-left done" 
								in:receive="{{key: item.id}}" 
								out:send="{{key: item.id}}"
								animate:flip="{{duration: 200}}"
								>
								<input type=checkbox checked on:change={() => mark(item, false)}>
								<span>{item.description}</span>
								<button on:click="{() => remove(item)}">remove</button>
							</label>
						{/each}
					</div>
				</div>
			</div>
		</div>

	</div>
</main>

<style lang="scss">
	@import './styles/vars';
	main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}

	h1 {
		color: $color;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}

	h2 {
		font-size: 2em;
		font-weight: 200;
		user-select: none;
		margin: 0 0 0.5em 0;
	}

	label {
		position: relative;
		line-height: 1.2;
		padding: 0.5em 2.5em 0.5em 2em;
		margin: 0 0 0.5em 0;
		border-radius: 2px;
		user-select: none;
		border: 1px solid hsl(240, 8%, 70%);
		background-color:hsl(240, 8%, 93%);
		color: #333;
	}

	input[type="checkbox"] {
		position: absolute;
		left: 0.5em;
		top: 0.6em;
		margin: 0;
	}

	.done {
		border: 1px solid hsl(240, 8%, 90%);
		background-color:hsl(240, 8%, 98%);
	}

	button {
		position: absolute;
		top: 0;
		right: 0.2em;
		width: 2em;
		height: 100%;
		background: no-repeat 50% 50% url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23676778' d='M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M17,7H14.5L13.5,6H10.5L9.5,7H7V9H17V7M9,18H15A1,1 0 0,0 16,17V10H8V17A1,1 0 0,0 9,18Z'%3E%3C/path%3E%3C/svg%3E");
		background-size: 1.4em 1.4em;
		border: none;
		opacity: 0;
		transition: opacity 0.2s;
		text-indent: -9999px;
		cursor: pointer;
	}

	label:hover button {
		opacity: 1;
	}
</style>