<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Adstock — Sua Agência de Marketing Autônoma</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap" rel="stylesheet">

<script>
tailwind.config = {
theme: {
extend: {
fontFamily: { sans: ['Inter', 'sans-serif'] },
colors: {
brand: {
50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f',
}
},
animation: { 'text-shimmer': 'text-shimmer 2.5s ease-out infinite alternate', 'float': 'float 6s ease-in-out infinite', 'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' },
keyframes: {
'text-shimmer': { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '100% 50%' } },
'float': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } }
}
}
}
}
</script>

<style>
@keyframes animationIn {
0% { opacity: 0; transform: translateY(30px) scale(0.95); filter: blur(12px); }
100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
}
@keyframes fadeIn {
0% { opacity: 0; filter: blur(8px); }
100% { opacity: 1; filter: blur(0px); }
}
.animate-on-scroll { animation-play-state: paused !important; }
.animate-on-scroll.animate { animation-play-state: running !important; }
.glass-panel {
background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
backdrop-filter: blur(24px);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
.text-gradient {
background: linear-gradient(to right, #ffffff, #a3a3a3);
-webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.text-gradient-gold {
background: linear-gradient(135deg, #fbbf24 0%, #fef3c7 50%, #d97706 100%);
background-size: 200% auto;
-webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.btn-premium {
cursor: pointer; position: relative; display: inline-flex; align-items: center; justify-content: center; overflow: hidden;
transition: all 0.4s cubic-bezier(0.15, 0.83, 0.66, 1);
background: radial-gradient(65.28% 65.28% at 50% 100%, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0) 100%), linear-gradient(0deg, #171717, #171717);
border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 0.75rem 1.5rem; outline: none;
}
.btn-premium::before {
content: ""; position: absolute; inset: 0;
background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
border-radius: inherit; opacity: 0; transition: opacity 0.3s ease; z-index: 0;
}
.btn-premium:hover::before { opacity: 1; }
.btn-premium:hover { border-color: rgba(251, 191, 36, 0.5); box-shadow: 0 0 20px rgba(251, 191, 36, 0.2); transform: translateY(-2px); }
.btn-premium:active { transform: scale(0.95); }
.btn-premium-inner { z-index: 2; gap: 0.5rem; position: relative; color: #fafafa; display: inline-flex; align-items: center; }
.btn-premium:hover .btn-icon { transform: translateX(3px); }
.points_wrapper { overflow: hidden; width: 100%; height: 100%; pointer-events: none; position: absolute; z-index: 1; border-radius: inherit; }
.points_wrapper .point {
bottom: -10px; position: absolute; animation: floating-points infinite ease-in-out; pointer-events: none;
width: 2px; height: 2px; background-color: #fbbf24; border-radius: 9999px; box-shadow: 0 0 4px #fbbf24;
}
@keyframes floating-points {
0% { transform: translateY(0) scale(1); opacity: 0; }
20% { opacity: 1; }
80% { opacity: 0.8; }
100% { transform: translateY(-40px) scale(0.5); opacity: 0; }
}
.points_wrapper .point:nth-child(1) { left: 15%; animation-duration: 2.1s; animation-delay: 0.1s; }
.points_wrapper .point:nth-child(2) { left: 35%; animation-duration: 2.4s; animation-delay: 0.4s; }
.points_wrapper .point:nth-child(3) { left: 55%; animation-duration: 1.9s; animation-delay: 0.2s; }
.points_wrapper .point:nth-child(4) { left: 75%; animation-duration: 2.6s; animation-delay: 0.5s; }
.points_wrapper .point:nth-child(5) { left: 85%; animation-duration: 2.2s; animation-delay: 0.0s; }
.points_wrapper .point:nth-child(6) { left: 25%; animation-duration: 2.5s; animation-delay: 0.3s; }
.points_wrapper .point:nth-child(7) { left: 65%; animation-duration: 2.0s; animation-delay: 0.1s; }
.bg-ambient { position: absolute; border-radius: 50%; filter: blur(100px); z-index: -1; opacity: 0.4; pointer-events: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
details > summary { list-style: none; }
details > summary::-webkit-details-marker { display: none; }
details[open] summary ~ * { animation: fadeIn 0.3s ease-in-out; }
details[open] summary .faq-icon { transform: rotate(45deg); }
</style>

<script>
(function () {
const once = true;
if (!window.__inViewIO) {
window.__inViewIO = new IntersectionObserver((entries) => {
entries.forEach((entry) => {
if (entry.isIntersecting) { entry.target.classList.add("animate"); if (once) window.__inViewIO.unobserve(entry.target); }
});
}, { threshold: 0.15, rootMargin: "0px 0px -5% 0px" });
}
document.querySelectorAll(".animate-on-scroll").forEach(el => window.__inViewIO?.observe(el));
})();
</script>
</head>

<body class="bg-[#050505] text-neutral-300 font-sans antialiased selection:bg-brand-500/30 selection:text-white overflow-x-hidden relative">

<div class="bg-ambient w-[600px] h-[600px] bg-brand-900/20 top-[-200px] left-[-200px]"></div>
<div class="bg-ambient w-[800px] h-[800px] bg-neutral-900/40 top-[20%] right-[-300px]"></div>

<!-- ── HEADER ── -->
<header class="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[calc(100%-3rem)] sm:max-w-max transition-all duration-500">
<div class="flex items-center justify-between rounded-full bg-white/[0.03] border border-white/10 px-4 py-2.5 sm:px-6 backdrop-blur-xl shadow-none transition-all duration-500 overflow-hidden">
<div class="flex items-center gap-2 cursor-pointer group hover:opacity-80 transition-opacity whitespace-nowrap">
<iconify-icon icon="solar:rocket-linear" class="text-brand-400 text-xl group-hover:rotate-12 transition-transform duration-300"></iconify-icon>
<span class="text-sm font-medium tracking-tight text-white">ADSTOCK</span>
</div>
<div class="hidden md:flex items-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] max-w-[500px] opacity-100 px-6">
<nav class="flex items-center gap-8 text-xs font-medium text-neutral-400 whitespace-nowrap">
<a href="#como-funciona" class="hover:text-white transition-colors hover:-translate-y-0.5 duration-300">Como funciona</a>
<a href="#agentes" class="hover:text-white transition-colors hover:-translate-y-0.5 duration-300">Agentes</a>
<a href="#resultados" class="hover:text-white transition-colors hover:-translate-y-0.5 duration-300">Resultados</a>
<a href="#precos" class="hover:text-white transition-colors hover:-translate-y-0.5 duration-300">Precos</a>
</nav>
</div>
<div class="flex items-center pl-2 sm:pl-0">
<div class="hidden sm:block overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] max-w-[100px] opacity-100">
<a href="/login" class="text-xs font-medium text-neutral-300 hover:text-white transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap pr-4">Login</a>
</div>
<a href="/register" class="relative inline-flex items-center justify-center rounded-full bg-white text-black px-4 py-1.5 text-xs font-medium transition-all duration-300 hover:bg-neutral-200 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] whitespace-nowrap">
Comecar agora
</a>
</div>
</div>
</header>

<main class="pt-32 pb-24">

<!-- ══════ HERO ══════ -->
<section id="home" class="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24 text-center flex flex-col items-center">

<div class="animate-on-scroll [animation:fadeIn_1s_ease-out_0s_both] mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 backdrop-blur-md">
<iconify-icon icon="solar:magic-stick-3-linear" class="text-brand-400"></iconify-icon>
5 agentes de IA. 24 horas. Zero esforco.
</div>

<h1 class="animate-on-scroll [animation:animationIn_1s_ease-out_0.1s_both] max-w-4xl text-5xl md:text-7xl font-medium tracking-tight text-white leading-[1.1]">
Marketing que<br class="hidden sm:block">
<span class="text-gradient-gold animate-text-shimmer">trabalha enquanto voce dorme.</span>
</h1>

<p class="animate-on-scroll [animation:animationIn_1s_ease-out_0.2s_both] mt-6 max-w-2xl text-sm md:text-base text-neutral-400 leading-relaxed font-light">
Uma agencia completa de marketing operada por IA. Eles fazem reuniao, criam artes, analisam metricas, publicam posts — sozinhos. Voce so aprova.
</p>

<div class="animate-on-scroll [animation:animationIn_1s_ease-out_0.3s_both] mt-10 flex flex-col sm:flex-row items-center gap-4">
<a href="/register" class="btn-premium w-full sm:w-auto">
<div class="points_wrapper">
<i class="point"></i><i class="point"></i><i class="point"></i><i class="point"></i><i class="point"></i><i class="point"></i><i class="point"></i>
</div>
<span class="btn-premium-inner text-xs font-medium tracking-normal">
Contratar minha equipe
<iconify-icon icon="solar:arrow-right-linear" class="text-brand-400 text-sm transition-transform duration-300 btn-icon"></iconify-icon>
</span>
</a>
<a href="#como-funciona" class="group relative inline-flex items-center justify-center rounded-full px-6 py-3 text-xs font-medium text-neutral-300 transition-all duration-300 hover:text-white hover:bg-white/5 active:scale-95">
<span class="relative z-10 flex items-center gap-2">
<iconify-icon icon="solar:play-circle-linear" class="text-base group-hover:text-brand-400 transition-colors duration-300"></iconify-icon>
Ver como funciona
</span>
</a>
</div>

<!-- Hero Mockup — Agent Office -->
<div class="animate-on-scroll [animation:animationIn_1.2s_ease-out_0.5s_both] mt-20 w-full max-w-6xl relative">
<div class="absolute inset-0 bg-brand-500/10 blur-[100px] rounded-full scale-75 transform -translate-y-10"></div>
<div class="glass-panel rounded-2xl overflow-hidden relative z-10 transform-gpu hover:scale-[1.01] transition-transform duration-700 ease-out shadow-2xl shadow-black/80 ring-1 ring-white/5">

<div class="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 bg-black/40">
<div class="flex items-center gap-3">
<div class="flex gap-1.5">
<div class="h-2 w-2 rounded-full bg-white/20"></div>
<div class="h-2 w-2 rounded-full bg-white/20"></div>
<div class="h-2 w-2 rounded-full bg-white/20"></div>
</div>
<div class="hidden sm:flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-neutral-400 border border-white/5">
<iconify-icon icon="solar:calendar-linear"></iconify-icon>
Daily · 09:00
</div>
</div>
<div class="flex items-center gap-3 text-neutral-400 text-sm">
<div class="hidden sm:flex items-center gap-2 rounded-md bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-300 border border-brand-500/20">
<iconify-icon icon="solar:users-group-rounded-linear"></iconify-icon>
5 agentes online
</div>
</div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-12 min-h-[500px] bg-gradient-to-br from-[#0a0a0a] to-[#050505]">

<!-- Left sidebar — Agents -->
<div class="hidden lg:block lg:col-span-3 border-r border-white/[0.06] p-4">
<div class="space-y-4">
<div>
<div class="text-xs font-medium tracking-tight text-neutral-500 mb-3 uppercase">Seu time</div>
<ul class="space-y-1.5 text-xs text-neutral-400">
<li class="flex items-center gap-2 rounded-md bg-brand-500/10 text-brand-200 px-2 py-1.5 border border-brand-500/20">
<iconify-icon icon="solar:crown-star-linear"></iconify-icon> Maya Ferreira
</li>
<li class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4">
<iconify-icon icon="solar:pen-new-square-linear"></iconify-icon> Bruno Costa
</li>
<li class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4">
<iconify-icon icon="solar:chart-linear"></iconify-icon> Lena Souza
</li>
<li class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4">
<iconify-icon icon="solar:gallery-wide-linear"></iconify-icon> Carlos Lima
</li>
<li class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors ml-4">
<iconify-icon icon="solar:magnifer-linear"></iconify-icon> Diego Ramos
</li>
</ul>
</div>
<div>
<div class="text-xs font-medium tracking-tight text-neutral-500 mb-3 uppercase">Canais</div>
<div class="space-y-1 text-xs text-neutral-400">
<div class="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5">📷 Instagram</div>
<div class="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5">💼 LinkedIn</div>
<div class="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5">📌 Pinterest</div>
</div>
</div>
</div>
</div>

<!-- Center — Chat simulation -->
<div class="lg:col-span-6 relative flex items-center justify-center p-8 overflow-hidden group">
<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsLCAyNTUsIDAuMDUpIi8+PC9zdmc+')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"></div>
<div class="relative w-64 h-64 animate-float">
<div class="absolute inset-0 bg-gradient-to-tr from-brand-600/40 to-transparent rounded-full blur-2xl"></div>
<div class="absolute inset-4 rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-xl flex items-center justify-center shadow-2xl transform -rotate-6 group-hover:rotate-0 transition-transform duration-1000 ease-out">
<div class="w-32 h-32 p-4 flex flex-col items-center justify-center text-center transform rotate-6 group-hover:rotate-0 transition-transform duration-1000 ease-out delay-75">
<iconify-icon icon="solar:chat-round-dots-linear" class="text-3xl text-brand-300 mb-2"></iconify-icon>
<p class="text-[10px] text-neutral-300 font-medium">Bom dia, time!<br>Prioridades de hoje:<br>calendario +<br>campanha + SEO</p>
</div>
</div>
</div>
</div>

<!-- Right panel — Tasks -->
<div class="hidden lg:block lg:col-span-3 border-l border-white/[0.06] p-4 bg-black/20">
<div class="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06]">
<span class="text-xs font-medium tracking-tight text-neutral-500 uppercase">Kanban</span>
<iconify-icon icon="solar:tuning-square-2-linear" class="text-neutral-400"></iconify-icon>
</div>
<div class="space-y-3 text-xs text-neutral-300">
<div class="bg-white/5 border border-white/5 rounded px-3 py-2">
<div class="flex items-center gap-2"><iconify-icon icon="solar:clock-circle-linear" class="text-brand-400"></iconify-icon><span class="text-brand-200">TODO</span></div>
<p class="text-neutral-400 mt-1">Post motivacional</p>
</div>
<div class="bg-white/5 border border-white/5 rounded px-3 py-2">
<div class="flex items-center gap-2"><iconify-icon icon="solar:play-circle-linear" class="text-brand-400"></iconify-icon><span class="text-neutral-300">IN PROGRESS</span></div>
<p class="text-neutral-400 mt-1">Carrossel Dia do Cliente</p>
</div>
<div class="bg-white/5 border border-white/5 rounded px-3 py-2">
<div class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-neutral-500"></iconify-icon><span class="text-neutral-500">DONE</span></div>
<p class="text-neutral-500 mt-1 line-through">Relatorio semanal</p>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

<!-- ══════ COMO FUNCIONA ══════ -->
<section id="como-funciona" class="relative z-10 mx-auto max-w-7xl px-6 py-24">
<div class="text-center mb-16">
<h2 class="text-3xl md:text-5xl font-medium tracking-tight text-white">Sua agencia em <span class="text-gradient-gold">3 passos</span></h2>
<p class="mt-4 text-neutral-400 text-sm max-w-xl mx-auto">Setup em 8 minutos. Operacao 100% automatica.</p>
</div>

<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0s_both] glass-panel rounded-2xl p-8 text-center group hover:scale-[1.02] transition-transform duration-500">
<div class="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:user-speak-rounded-linear" class="text-2xl text-brand-400"></iconify-icon>
</div>
<h3 class="text-lg font-medium text-white mb-2">1. Voce conta sobre seu negocio</h3>
<p class="text-xs text-neutral-400 leading-relaxed">Onboarding em 8 minutos. A gente entende seu segmento, tom de voz, publico e objetivos.</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0.1s_both] glass-panel rounded-2xl p-8 text-center group hover:scale-[1.02] transition-transform duration-500">
<div class="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:calendar-linear" class="text-2xl text-brand-400"></iconify-icon>
</div>
<h3 class="text-lg font-medium text-white mb-2">2. Todo dia as 9h, sua equipe planeja</h3>
<p class="text-xs text-neutral-400 leading-relaxed">Daily automatica com 5 agentes. Maya distribui tarefas, Carlos cria artes, Bruno agenda.</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0.2s_both] glass-panel rounded-2xl p-8 text-center group hover:scale-[1.02] transition-transform duration-500">
<div class="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:graph-up-linear" class="text-2xl text-brand-400"></iconify-icon>
</div>
<h3 class="text-lg font-medium text-white mb-2">3. Voce aprova. O sistema publica.</h3>
<p class="text-xs text-neutral-400 leading-relaxed">Receba as artes para aprovacao. Deu ok? O sistema publica no melhor horario. Nao gostou? Pede revisao.</p>
</div>
</div>
</section>

<!-- ══════ AGENTES ══════ -->
<section id="agentes" class="relative z-10 mx-auto max-w-7xl px-6 py-24">
<div class="text-center mb-16">
<h2 class="text-3xl md:text-5xl font-medium tracking-tight text-white">Seu time de <span class="text-gradient-gold">especialistas</span></h2>
<p class="mt-4 text-neutral-400 text-sm max-w-xl mx-auto">5 agentes de IA, cada um especialista em uma area. Eles trabalham juntos, 24 horas por dia.</p>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
<div class="animate-on-scroll [animation:animationIn_0.6s_ease-out_0s_both] glass-panel rounded-2xl p-6 text-center group hover:scale-105 transition-transform duration-500">
<div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:crown-star-linear" class="text-xl text-brand-400"></iconify-icon>
</div>
<h4 class="text-sm font-medium text-white">Maya Ferreira</h4>
<p class="text-xs text-neutral-400 mt-1">Diretora de Conteudo</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.6s_ease-out_0.05s_both] glass-panel rounded-2xl p-6 text-center group hover:scale-105 transition-transform duration-500">
<div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:pen-new-square-linear" class="text-xl text-brand-400"></iconify-icon>
</div>
<h4 class="text-sm font-medium text-white">Bruno Costa</h4>
<p class="text-xs text-neutral-400 mt-1">Social Media</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.6s_ease-out_0.1s_both] glass-panel rounded-2xl p-6 text-center group hover:scale-105 transition-transform duration-500">
<div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:chart-linear" class="text-xl text-brand-400"></iconify-icon>
</div>
<h4 class="text-sm font-medium text-white">Lena Souza</h4>
<p class="text-xs text-neutral-400 mt-1">Analista de Metricas</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.6s_ease-out_0.15s_both] glass-panel rounded-2xl p-6 text-center group hover:scale-105 transition-transform duration-500">
<div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:gallery-wide-linear" class="text-xl text-brand-400"></iconify-icon>
</div>
<h4 class="text-sm font-medium text-white">Carlos Lima</h4>
<p class="text-xs text-neutral-400 mt-1">Designer</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.6s_ease-out_0.2s_both] glass-panel rounded-2xl p-6 text-center group hover:scale-105 transition-transform duration-500">
<div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
<iconify-icon icon="solar:magnifer-linear" class="text-xl text-brand-400"></iconify-icon>
</div>
<h4 class="text-sm font-medium text-white">Diego Ramos</h4>
<p class="text-xs text-neutral-400 mt-1">Especialista em SEO</p>
</div>
</div>
</section>

<!-- ══════ RESULTADOS ══════ -->
<section id="resultados" class="relative z-10 mx-auto max-w-7xl px-6 py-24">
<div class="text-center mb-16">
<h2 class="text-3xl md:text-5xl font-medium tracking-tight text-white">Resultados <span class="text-gradient-gold">reais</span></h2>
<p class="mt-4 text-neutral-400 text-sm max-w-xl mx-auto">O que nossos clientes estao conquistando com a agencia autonoma.</p>
</div>

<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0s_both] glass-panel rounded-2xl p-8">
<div class="text-4xl font-medium text-white mb-3">+340%</div>
<div class="text-xs text-neutral-400 uppercase tracking-wider mb-4">Alcance no Instagram</div>
<p class="text-xs text-neutral-500 leading-relaxed">Posts diarios com conteudo relevante, publicados no melhor horario. Engajamento consistente.</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0.1s_both] glass-panel rounded-2xl p-8">
<div class="text-4xl font-medium text-white mb-3">8min</div>
<div class="text-xs text-neutral-400 uppercase tracking-wider mb-4">Setup completo</div>
<p class="text-xs text-neutral-500 leading-relaxed">Do onboarding a primeira publicacao em menos de 10 minutos. Zero configuracao tecnica.</p>
</div>

<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0.2s_both] glass-panel rounded-2xl p-8">
<div class="text-4xl font-medium text-white mb-3">90%</div>
<div class="text-xs text-neutral-400 uppercase tracking-wider mb-4">Taxa de aprovacao</div>
<p class="text-xs text-neutral-500 leading-relaxed">Conteudo alinhado com a identidade da marca. A IA aprende com cada feedback do CEO.</p>
</div>
</div>
</section>

<!-- ══════ PRECOS ══════ -->
<section id="precos" class="relative z-10 mx-auto max-w-7xl px-6 py-24">
<div class="text-center mb-16">
<h2 class="text-3xl md:text-5xl font-medium tracking-tight text-white">Menos que um almoco <span class="text-gradient-gold">por dia</span></h2>
<p class="mt-4 text-neutral-400 text-sm">Sem contrato. Cancele quando quiser.</p>
</div>

<div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0s_both] glass-panel rounded-2xl p-8 border border-white/[0.04]">
<h4 class="text-lg font-medium text-white mb-1">Starter</h4>
<div class="mt-4 mb-6"><span class="text-4xl font-medium text-white">R$97</span><span class="text-xs text-neutral-500">/mes</span></div>
<ul class="space-y-2 text-xs text-neutral-400 mb-8">
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>3 agentes</li>
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>30 posts/mes</li>
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>2 redes sociais</li>
</ul>
<a href="/register" class="block text-center rounded-full bg-white/5 border border-white/10 py-2.5 text-xs font-medium text-white hover:bg-white/10 transition-all">Comecar</a>
</div>

<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0.1s_both] rounded-2xl p-8 border border-brand-500/30 bg-brand-500/5 relative">
<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-black text-[10px] font-semibold px-3 py-0.5 rounded-full uppercase">Mais popular</div>
<h4 class="text-lg font-medium text-white mb-1">Growth</h4>
<div class="mt-4 mb-6"><span class="text-4xl font-medium text-white">R$197</span><span class="text-xs text-neutral-500">/mes</span></div>
<ul class="space-y-2 text-xs text-neutral-400 mb-8">
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>6 agentes</li>
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>90 posts/mes</li>
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>4 redes sociais</li>
</ul>
<a href="/register" class="block text-center rounded-full bg-brand-500 text-black py-2.5 text-xs font-semibold hover:bg-brand-400 transition-all">Comecar</a>
</div>

<div class="animate-on-scroll [animation:animationIn_0.8s_ease-out_0.2s_both] glass-panel rounded-2xl p-8 border border-white/[0.04]">
<h4 class="text-lg font-medium text-white mb-1">Agency</h4>
<div class="mt-4 mb-6"><span class="text-4xl font-medium text-white">R$397</span><span class="text-xs text-neutral-500">/mes</span></div>
<ul class="space-y-2 text-xs text-neutral-400 mb-8">
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>10 agentes</li>
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>Posts ilimitados</li>
<li class="flex items-center gap-2"><iconify-icon icon="solar:check-circle-linear" class="text-brand-400"></iconify-icon>Redes ilimitadas</li>
</ul>
<a href="/register" class="block text-center rounded-full bg-white/5 border border-white/10 py-2.5 text-xs font-medium text-white hover:bg-white/10 transition-all">Comecar</a>
</div>
</div>
</section>

<!-- ══════ FAQ ══════ -->
<section class="relative z-10 mx-auto max-w-3xl px-6 py-24">
<div class="text-center mb-16">
<h2 class="text-3xl md:text-5xl font-medium tracking-tight text-white">Perguntas <span class="text-gradient-gold">frequentes</span></h2>
</div>
<div class="space-y-3">
<details class="glass-panel rounded-2xl p-5 group cursor-pointer">
<summary class="flex items-center justify-between text-sm font-medium text-white">
<span>Preciso saber de marketing?</span>
<iconify-icon icon="solar:add-circle-linear" class="faq-icon text-neutral-400 text-lg transition-transform duration-300"></iconify-icon>
</summary>
<p class="mt-4 text-xs text-neutral-400 leading-relaxed">Nao. Voce fala sobre seu negocio no onboarding e os agentes cuidam de tudo — estrategia, criacao, publicacao.</p>
</details>

<details class="glass-panel rounded-2xl p-5 group cursor-pointer">
<summary class="flex items-center justify-between text-sm font-medium text-white">
<span>Os agentes publicam sozinhos?</span>
<iconify-icon icon="solar:add-circle-linear" class="faq-icon text-neutral-400 text-lg transition-transform duration-300"></iconify-icon>
</summary>
<p class="mt-4 text-xs text-neutral-400 leading-relaxed">As artes sao enviadas para sua aprovacao. Voce aprova ou pede revisao em um clique. Depois de aprovado, o sistema publica no melhor horario.</p>
</details>

<details class="glass-panel rounded-2xl p-5 group cursor-pointer">
<summary class="flex items-center justify-between text-sm font-medium text-white">
<span>Posso cancelar a qualquer momento?</span>
<iconify-icon icon="solar:add-circle-linear" class="faq-icon text-neutral-400 text-lg transition-transform duration-300"></iconify-icon>
</summary>
<p class="mt-4 text-xs text-neutral-400 leading-relaxed">Sim. Sem contrato, sem multa. Cancele quando quiser.</p>
</details>

<details class="glass-panel rounded-2xl p-5 group cursor-pointer">
<summary class="flex items-center justify-between text-sm font-medium text-white">
<span>Funciona para qualquer segmento?</span>
<iconify-icon icon="solar:add-circle-linear" class="faq-icon text-neutral-400 text-lg transition-transform duration-300"></iconify-icon>
</summary>
<p class="mt-4 text-xs text-neutral-400 leading-relaxed">Sim. A IA se adapta ao seu segmento, tom de voz e publico durante o onboarding. Moda, saude, tech, alimentacao — todos funcionam.</p>
</details>
</div>
</section>

</main>

<!-- ══════ FOOTER ══════ -->
<footer class="relative z-10 border-t border-white/[0.06] py-12">
<div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
<div class="flex items-center gap-2 text-neutral-400 text-xs">
<iconify-icon icon="solar:rocket-linear" class="text-brand-400"></iconify-icon>
<span class="text-neutral-500">Adstock © 2025 — Sua agencia autonoma de marketing</span>
</div>
<div class="flex items-center gap-6 text-xs text-neutral-500">
<a href="#" class="hover:text-neutral-300 transition-colors">Termos</a>
<a href="#" class="hover:text-neutral-300 transition-colors">Privacidade</a>
<a href="#" class="hover:text-neutral-300 transition-colors">Contato</a>
</div>
</div>
</footer>

</body>
</html>
