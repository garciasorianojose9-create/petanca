#!/usr/bin/env node
/**
 * Simulador de carga concurrente (300 usuarios simultáneos por defecto)
 * Uso:
 *   node scripts/load-test-300.mjs --url=http://localhost:3000 --users=300
 *   node scripts/load-test-300.mjs --url=https://petancamurcia.es --users=300 --username=admin --password=TU_CLAVE
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const clean = arg.replace(/^--/, '');
    const eq = clean.indexOf('=');
    if (eq === -1) return [clean, 'true'];
    return [clean.slice(0, eq), clean.slice(eq + 1)];
  })
);

const BASE_URL = (args.url || process.env.LOAD_TEST_URL || 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENT_USERS = Math.max(1, parseInt(args.users || process.env.LOAD_TEST_USERS || '300', 10));
const POLL_ROUNDS = Math.max(1, parseInt(args.rounds || '3', 10));
const USERNAME = args.username || process.env.LOAD_TEST_USER || 'admin';
const PASSWORD = args.password || process.env.LOAD_TEST_PASS || 'admin123';

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(name, results) {
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const max = latencies[latencies.length - 1] || 0;

  console.log(`\n📊 ${name}`);
  console.log(`   Peticiones : ${results.length} | Éxitos: ${ok.length} (${((ok.length / (results.length || 1)) * 100).toFixed(1)}%) | Fallos: ${fail.length}`);
  console.log(`   Latencia   : Media ${avg.toFixed(1)}ms | P50 ${p50.toFixed(1)}ms | P95 ${p95.toFixed(1)}ms | P99 ${p99.toFixed(1)}ms | Máx ${max.toFixed(1)}ms`);
  if (fail.length > 0) {
    const sampleErrors = {};
    for (const f of fail) {
      const k = `${f.status} ${f.error || ''}`.trim();
      sampleErrors[k] = (sampleErrors[k] || 0) + 1;
    }
    console.log('   Errores    :', sampleErrors);
  }
  return { total: results.length, ok: ok.length, fail: fail.length, p95 };
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, options);
    await res.arrayBuffer();
    return { ok: res.ok, status: res.status, ms: performance.now() - start };
  } catch (err) {
    return { ok: false, status: 0, error: err?.message || 'network_error', ms: performance.now() - start };
  }
}

async function run() {
  console.log('==============================================================');
  console.log(`🚀 PRUEBA DE CARGA SIMULADA — ${CONCURRENT_USERS} USUARIOS SIMULTÁNEOS`);
  console.log(`🎯 Objetivo: ${BASE_URL}`);
  console.log('==============================================================');

  // 0. Healthcheck
  const healthStart = performance.now();
  const healthRes = await fetch(`${BASE_URL}/api/health`).catch((e) => ({ ok: false, status: 0, err: e.message }));
  if (!healthRes.ok) {
    console.error(`❌ El servidor en ${BASE_URL} no responde a /api/health (status: ${healthRes.status}).`);
    process.exit(1);
  }
  const healthJson = await healthRes.json();
  console.log(`✅ Servidor activo (${(performance.now() - healthStart).toFixed(1)}ms) | Usuarios en BD: ${healthJson.usersCount}`);

  // 1. Security Sanity Check (sin sesión debe devolver 401)
  const secRes = await fetch(`${BASE_URL}/api/data`);
  if (secRes.status === 401) {
    console.log('🔒 Seguridad verificada: /api/data sin sesión devuelve 401 Unauthorized.');
  } else {
    console.warn(`⚠️ Alerta de seguridad: /api/data sin sesión devolvió HTTP ${secRes.status} (se esperaba 401).`);
  }

  // 2. Fase 1: 300 inicios de sesión simultáneos
  const loginStart = performance.now();
  const tokens = [];
  const loginResults = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, async () => {
      const start = performance.now();
      try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.token) {
          tokens.push(data.token);
        }
        return { ok: res.ok, status: res.status, ms: performance.now() - start, error: data.message };
      } catch (err) {
        return { ok: false, status: 0, ms: performance.now() - start, error: err?.message };
      }
    })
  );
  const loginElapsed = ((performance.now() - loginStart) / 1000).toFixed(2);
  const s1 = summarize(`Fase 1: ${CONCURRENT_USERS} logins simultáneos (${loginElapsed}s total)`, loginResults);

  if (tokens.length === 0) {
    console.error('❌ Ningún login obtuvo token. Revisa usuario/contraseña de prueba (--username= --password=).');
    process.exit(1);
  }

  // 3. Fase 2: 300 usuarios cargando la aplicación completa (/api/data) a la vez
  const dataStart = performance.now();
  const dataResults = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, (_, idx) => {
      const token = tokens[idx % tokens.length];
      return timedFetch(`${BASE_URL}/api/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    })
  );
  const dataElapsed = ((performance.now() - dataStart) / 1000).toFixed(2);
  const s2 = summarize(`Fase 2: ${CONCURRENT_USERS} descargas simultáneas /api/data (${dataElapsed}s total)`, dataResults);

  // 4. Fase 3: Sondeo en directo (3 rondas x 300 usuarios = 900 peticiones)
  const pollStart = performance.now();
  const pollResults = [];
  for (let r = 0; r < POLL_ROUNDS; r++) {
    const roundRes = await Promise.all(
      Array.from({ length: CONCURRENT_USERS }, (_, idx) => {
        const token = tokens[idx % tokens.length];
        return timedFetch(`${BASE_URL}/api/data/version`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
    );
    pollResults.push(...roundRes);
  }
  const pollElapsed = ((performance.now() - pollStart) / 1000).toFixed(2);
  const s3 = summarize(`Fase 3: ${POLL_ROUNDS} rondas de sondeo live x ${CONCURRENT_USERS} usuarios (${pollElapsed}s total)`, pollResults);

  // Resumen Final
  const totalReq = s1.total + s2.total + s3.total;
  const totalOk = s1.ok + s2.ok + s3.ok;
  const totalFail = s1.fail + s2.fail + s3.fail;

  console.log('\n==============================================================');
  console.log(`🏁 RESUMEN FINAL: ${totalOk}/${totalReq} peticiones exitosas (${((totalOk / totalReq) * 100).toFixed(2)}%)`);
  if (totalFail === 0 && secRes.status === 401) {
    console.log('✅ RESULTADO EXCELENTE: El servidor soportó los 300 usuarios concurrentes sin errores.');
  } else {
    console.log(`⚠️ ATENCIÓN: Se registraron ${totalFail} errores durante el pico de carga.`);
  }
  console.log('==============================================================\n');
}

run();
