#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const SWAGGER_URL = 'http://localhost:4000/api/docs-json';

interface RouteInfo {
  module: string;
  controller: string;
  method: string;
  path: string;
  fullPath: string;
  guards: string[];
  roles: string[];
  summary: string;
  requiresAuth: boolean;
  requiresTenant: boolean;
  apiTags: string[];
}

interface TestResult {
  route: RouteInfo;
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
  contentType?: string;
}

interface ModuleStats {
  module: string;
  totalEndpoints: number;
  tested: number;
  passed: number;
  unauthorized: number;
  notFound: number;
  errors: number;
  coverage: number;
}

// Parse controller file to extract route information
function parseController(filePath: string): RouteInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const routes: RouteInfo[] = [];

  const relativePath = path.relative(
    path.join(__dirname, '../src'),
    filePath
  );
  const moduleName = relativePath.split('/')[1] || 'root';
  const controllerName = path.basename(filePath, '.controller.ts');

  // Extract @Controller path
  const controllerMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);
  const controllerPath = controllerMatch ? controllerMatch[1] : '';

  // Extract @ApiTags
  const apiTagsMatch = content.match(/@ApiTags\(['"]([^'"]*)['"]\)/);
  const apiTags = apiTagsMatch ? [apiTagsMatch[1]] : [];

  // Extract @UseGuards at controller level
  const controllerGuardsMatch = content.match(/@UseGuards\(([^)]+)\)/);
  const controllerGuards = controllerGuardsMatch
    ? controllerGuardsMatch[1].split(',').map(g => g.trim())
    : [];

  // Find all route methods
  const methodRegex = /@(Get|Post|Put|Delete|Patch)\((['"]([^'"]*)['"]\))?\s*(?:@[^\n]+\n\s*)*\s*(?:async\s+)?(\w+)\s*\(/g;
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    const httpMethod = match[1];
    const routePath = match[3] || '';
    const methodName = match[4];

    // Find the method body
    const methodStart = match.index;
    const methodEnd = findMethodEnd(content, methodStart);
    const methodBody = content.substring(methodStart, methodEnd);

    // Extract @UseGuards for this specific method
    const methodGuardsMatch = methodBody.match(/@UseGuards\(([^)]+)\)/);
    const methodGuards = methodGuardsMatch
      ? methodGuardsMatch[1].split(',').map(g => g.trim())
      : [];

    const allGuards = [...controllerGuards, ...methodGuards];

    // Extract @Roles
    const rolesMatch = methodBody.match(/@Roles\(['"]([^'"]*)['"]\)/);
    const roles = rolesMatch ? [rolesMatch[1]] : [];

    // Extract @ApiOperation summary
    const summaryMatch = methodBody.match(/@ApiOperation\(\s*\{\s*summary:\s*['"]([^'"]*)['"]/);
    const summary = summaryMatch ? summaryMatch[1] : '';

    const fullPath = `/${controllerPath}${routePath ? '/' + routePath : ''}`.replace(/\/+/g, '/');

    routes.push({
      module: moduleName,
      controller: controllerName,
      method: httpMethod.toUpperCase(),
      path: routePath,
      fullPath,
      guards: allGuards,
      roles,
      summary,
      requiresAuth: allGuards.some(g => g.includes('JwtAuthGuard') || g.includes('AuthGuard')),
      requiresTenant: true, // TenantContextInterceptor is global
      apiTags,
    });
  }

  return routes;
}

function findMethodEnd(content: string, startIndex: number): number {
  let braceCount = 0;
  let inMethod = false;

  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      inMethod = true;
    } else if (content[i] === '}') {
      braceCount--;
      if (inMethod && braceCount === 0) {
        return i + 1;
      }
    }
  }

  return content.length;
}

// Discover all controller files
function discoverControllers(): string[] {
  const srcDir = path.join(__dirname, '../src');
  const controllers: string[] = [];

  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.includes('node_modules')) {
        walk(filePath);
      } else if (file.endsWith('.controller.ts')) {
        controllers.push(filePath);
      }
    }
  }

  walk(srcDir);
  return controllers;
}

// Fetch Swagger documentation
async function fetchSwaggerDocs(): Promise<any> {
  try {
    const response = await axios.get(SWAGGER_URL, { timeout: 5000 });
    return response.data;
  } catch (error) {
    console.warn('⚠️  Could not fetch Swagger documentation. Is the server running?');
    return null;
  }
}

// Test endpoint
async function testEndpoint(route: RouteInfo): Promise<TestResult> {
  const startTime = Date.now();

  const headers: any = {
    'X-Tenant': 'demo-tenant',
    'Content-Type': 'application/json',
  };

  if (route.requiresAuth) {
    headers['Authorization'] = 'Bearer mock-jwt-token-for-testing';
  }

  try {
    const url = `${BASE_URL}${route.fullPath}`;
    let response;

    switch (route.method) {
      case 'GET':
        response = await axios.get(url, { headers, timeout: 5000, validateStatus: () => true });
        break;
      case 'POST':
        response = await axios.post(url, {}, { headers, timeout: 5000, validateStatus: () => true });
        break;
      case 'PUT':
        response = await axios.put(url, {}, { headers, timeout: 5000, validateStatus: () => true });
        break;
      case 'DELETE':
        response = await axios.delete(url, { headers, timeout: 5000, validateStatus: () => true });
        break;
      case 'PATCH':
        response = await axios.patch(url, {}, { headers, timeout: 5000, validateStatus: () => true });
        break;
      default:
        throw new Error(`Unsupported method: ${route.method}`);
    }

    const responseTime = Date.now() - startTime;

    return {
      route,
      status: response.status,
      responseTime,
      success: response.status >= 200 && response.status < 300,
      contentType: response.headers['content-type'],
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const axiosError = error as AxiosError;

    if (axiosError.response) {
      return {
        route,
        status: axiosError.response.status,
        responseTime,
        success: false,
        error: axiosError.message,
        contentType: axiosError.response.headers['content-type'] as string,
      };
    } else if (axiosError.code === 'ECONNREFUSED') {
      return {
        route,
        status: 0,
        responseTime,
        success: false,
        error: 'Connection refused - server not running',
      };
    } else {
      return {
        route,
        status: 0,
        responseTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Calculate module statistics
function calculateModuleStats(results: TestResult[]): ModuleStats[] {
  const moduleMap = new Map<string, TestResult[]>();

  results.forEach(result => {
    const module = result.route.module;
    if (!moduleMap.has(module)) {
      moduleMap.set(module, []);
    }
    moduleMap.get(module)!.push(result);
  });

  const stats: ModuleStats[] = [];

  moduleMap.forEach((moduleResults, moduleName) => {
    const totalEndpoints = moduleResults.length;
    const tested = moduleResults.filter(r => r.status !== 0).length;
    const passed = moduleResults.filter(r => r.success).length;
    const unauthorized = moduleResults.filter(r => r.status === 401).length;
    const notFound = moduleResults.filter(r => r.status === 404).length;
    const errors = moduleResults.filter(r => !r.success && r.status !== 401 && r.status !== 404).length;
    const coverage = totalEndpoints > 0 ? Math.round((passed / totalEndpoints) * 100) : 0;

    stats.push({
      module: moduleName,
      totalEndpoints,
      tested,
      passed,
      unauthorized,
      notFound,
      errors,
      coverage,
    });
  });

  return stats.sort((a, b) => b.coverage - a.coverage);
}

// Generate Markdown report
function generateMarkdownReport(
  routes: RouteInfo[],
  results: TestResult[],
  moduleStats: ModuleStats[],
  swaggerPaths?: any
): string {
  const report: string[] = [];

  report.push('# 🔍 API Coverage Report — Tourism AI Platform\n');
  report.push(`**Generated:** ${new Date().toISOString()}\n`);
  report.push(`**Total Endpoints Discovered:** ${routes.length}\n`);
  report.push(`**Base URL:** ${BASE_URL}\n`);
  report.push(`**Test Run:** ${results.length > 0 ? '✅ Completed' : '⚠️  Skipped (server not running)'}\n\n`);

  report.push('---\n\n');

  // Overall Statistics
  report.push('## 📊 Overall Statistics\n\n');

  const totalTested = results.filter(r => r.status !== 0).length;
  const totalPassed = results.filter(r => r.success).length;
  const totalUnauthorized = results.filter(r => r.status === 401).length;
  const totalNotFound = results.filter(r => r.status === 404).length;
  const totalErrors = results.filter(r => !r.success && r.status !== 401 && r.status !== 404 && r.status !== 0).length;
  const overallCoverage = routes.length > 0 ? Math.round((totalPassed / routes.length) * 100) : 0;

  report.push(`- **Total Endpoints:** ${routes.length}\n`);
  report.push(`- **Tested:** ${totalTested}\n`);
  report.push(`- **✅ Passed (2xx):** ${totalPassed}\n`);
  report.push(`- **⚠️  Unauthorized (401):** ${totalUnauthorized}\n`);
  report.push(`- **❌ Not Found (404):** ${totalNotFound}\n`);
  report.push(`- **🔥 Errors (5xx/other):** ${totalErrors}\n`);
  report.push(`- **📈 Overall Coverage:** ${overallCoverage}%\n\n`);

  report.push('---\n\n');

  // Module Statistics
  report.push('## 📦 Coverage by Module\n\n');
  report.push('| Module | Endpoints | OK | 401 | 404 | Errors | Coverage |\n');
  report.push('|--------|-----------|----|----|-----|---------|----------|\n');

  moduleStats.forEach(stat => {
    const coverageEmoji = stat.coverage >= 80 ? '✅' : stat.coverage >= 50 ? '⚠️' : '❌';
    report.push(`| ${stat.module} | ${stat.totalEndpoints} | ${stat.passed} | ${stat.unauthorized} | ${stat.notFound} | ${stat.errors} | ${coverageEmoji} ${stat.coverage}% |\n`);
  });

  report.push('\n---\n\n');

  // Detailed Results by Module
  report.push('## 📋 Detailed Results by Module\n\n');

  moduleStats.forEach(stat => {
    const moduleResults = results.filter(r => r.route.module === stat.module);

    report.push(`### ${stat.module} (${stat.coverage}% coverage)\n\n`);
    report.push('| Method | Path | Status | Time (ms) | Guards | Summary |\n');
    report.push('|--------|------|--------|-----------|--------|----------|\n');

    moduleResults.forEach(result => {
      const statusEmoji = result.success ? '✅' : result.status === 401 ? '🔒' : result.status === 404 ? '❌' : '🔥';
      const guardsStr = result.route.guards.length > 0 ? result.route.guards.join(', ') : 'None';

      report.push(`| ${result.route.method} | \`${result.route.fullPath}\` | ${statusEmoji} ${result.status || 'N/A'} | ${result.responseTime} | ${guardsStr} | ${result.route.summary || 'No description'} |\n`);
    });

    report.push('\n');
  });

  report.push('---\n\n');

  // Swagger Comparison
  if (swaggerPaths) {
    report.push('## 📚 Swagger Documentation Comparison\n\n');

    const discoveredPaths = new Set(routes.map(r => r.fullPath));
    const swaggerPathsList = Object.keys(swaggerPaths);
    const swaggerSet = new Set(swaggerPathsList);

    const missingInSwagger = routes.filter(r => !swaggerSet.has(r.fullPath));
    const deadSwaggerPaths = swaggerPathsList.filter(p => !discoveredPaths.has(p));

    report.push(`- **Total Swagger Paths:** ${swaggerPathsList.length}\n`);
    report.push(`- **Missing from Swagger:** ${missingInSwagger.length}\n`);
    report.push(`- **Dead Swagger Paths:** ${deadSwaggerPaths.length}\n\n`);

    if (missingInSwagger.length > 0) {
      report.push('### ⚠️  Routes Missing from Swagger\n\n');
      missingInSwagger.forEach(route => {
        report.push(`- \`${route.method} ${route.fullPath}\` — ${route.controller}.${route.path || 'index'}\n`);
      });
      report.push('\n');
    }

    if (deadSwaggerPaths.length > 0) {
      report.push('### 🗑️ Dead Swagger Paths (documented but not implemented)\n\n');
      deadSwaggerPaths.forEach(path => {
        report.push(`- \`${path}\`\n`);
      });
      report.push('\n');
    }
  }

  report.push('---\n\n');

  // Fix Recommendations
  report.push('## 🔧 Fix Recommendations\n\n');

  const unauthorized = results.filter(r => r.status === 401);
  const notFound = results.filter(r => r.status === 404);
  const undocumented = routes.filter(r => !r.summary);

  if (unauthorized.length > 0) {
    report.push('### 🔒 Unauthorized Endpoints (401)\n\n');
    report.push('These endpoints return 401 with mock JWT. Verify:\n');
    report.push('- JWT validation is not checking token validity in tests\n');
    report.push('- Guards are properly configured\n');
    report.push('- TenantContext is set correctly\n\n');

    unauthorized.forEach(result => {
      report.push(`- \`${result.route.method} ${result.route.fullPath}\`\n`);
      report.push(`  - **Fix:** Ensure \`@UseGuards(JwtAuthGuard)\` is present if auth is required\n`);
    });
    report.push('\n');
  }

  if (notFound.length > 0) {
    report.push('### ❌ Not Found Endpoints (404)\n\n');
    report.push('These endpoints were discovered but returned 404:\n\n');

    notFound.forEach(result => {
      report.push(`- \`${result.route.method} ${result.route.fullPath}\`\n`);
      report.push(`  - **Module:** ${result.route.module}\n`);
      report.push(`  - **Fix:** Check if module is imported in \`app.module.ts\`\n`);
    });
    report.push('\n');
  }

  if (undocumented.length > 0) {
    report.push('### 📝 Undocumented Endpoints\n\n');
    report.push('These endpoints lack API documentation:\n\n');

    undocumented.forEach(route => {
      report.push(`- \`${route.method} ${route.fullPath}\`\n`);
      report.push(`  - **Fix:** Add \`@ApiOperation({ summary: 'Description here' })\`\n`);
    });
    report.push('\n');
  }

  report.push('---\n\n');

  report.push('## ✅ Validation Checklist\n\n');
  report.push('- [ ] All endpoints return expected status codes\n');
  report.push('- [ ] All endpoints documented in Swagger\n');
  report.push('- [ ] Auth guards properly configured\n');
  report.push('- [ ] Tenant context enforced where needed\n');
  report.push('- [ ] Response times under 500ms\n');
  report.push('- [ ] Content-Type headers correct\n\n');

  report.push('---\n\n');
  report.push('**Audit Complete** ✅\n');

  return report.join('');
}

// Main execution
async function main() {
  console.log('🔍 Starting API Audit...\n');

  // Step 1: Discover all controllers
  console.log('📂 Discovering controllers...');
  const controllerFiles = discoverControllers();
  console.log(`   Found ${controllerFiles.length} controllers\n`);

  // Step 2: Parse routes from controllers
  console.log('🔍 Parsing routes...');
  const allRoutes: RouteInfo[] = [];

  for (const file of controllerFiles) {
    const routes = parseController(file);
    allRoutes.push(...routes);
  }

  console.log(`   Discovered ${allRoutes.length} endpoints\n`);

  // Step 3: Save routes to JSON
  const routesJsonPath = path.join(__dirname, 'api_routes.json');
  fs.writeFileSync(routesJsonPath, JSON.stringify(allRoutes, null, 2));
  console.log(`✅ Saved routes to ${routesJsonPath}\n`);

  // Step 4: Fetch Swagger documentation
  console.log('📚 Fetching Swagger documentation...');
  const swaggerDocs = await fetchSwaggerDocs();

  if (swaggerDocs) {
    console.log(`   Found ${Object.keys(swaggerDocs.paths || {}).length} Swagger paths\n`);
  }

  // Step 5: Run dynamic tests
  console.log('🧪 Running dynamic tests...');
  const results: TestResult[] = [];

  for (const route of allRoutes) {
    process.stdout.write(`   Testing ${route.method} ${route.fullPath}... `);
    const result = await testEndpoint(route);
    results.push(result);

    const statusEmoji = result.success ? '✅' : result.status === 401 ? '🔒' : result.status === 404 ? '❌' : '🔥';
    console.log(`${statusEmoji} ${result.status || 'ERROR'} (${result.responseTime}ms)`);
  }

  console.log('');

  // Step 6: Calculate statistics
  console.log('📊 Calculating statistics...');
  const moduleStats = calculateModuleStats(results);
  console.log('');

  // Step 7: Generate reports
  console.log('📝 Generating reports...');

  const reportPath = path.join(__dirname, '../docs/API_COVERAGE_REPORT.md');
  const report = generateMarkdownReport(allRoutes, results, moduleStats, swaggerDocs?.paths);
  fs.writeFileSync(reportPath, report);
  console.log(`✅ Report saved to ${reportPath}\n`);

  // Save raw results
  const resultsPath = path.join(__dirname, 'api_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({ routes: allRoutes, results, moduleStats }, null, 2));
  console.log(`✅ Results saved to ${resultsPath}\n`);

  // Print summary
  console.log('📊 Summary:\n');
  console.log(`Total Endpoints: ${allRoutes.length}`);
  console.log(`Tested: ${results.filter(r => r.status !== 0).length}`);
  console.log(`✅ Passed: ${results.filter(r => r.success).length}`);
  console.log(`⚠️  401 Unauthorized: ${results.filter(r => r.status === 401).length}`);
  console.log(`❌ 404 Not Found: ${results.filter(r => r.status === 404).length}`);
  console.log(`🔥 Errors: ${results.filter(r => !r.success && r.status !== 401 && r.status !== 404 && r.status !== 0).length}`);

  const overallCoverage = allRoutes.length > 0 ? Math.round((results.filter(r => r.success).length / allRoutes.length) * 100) : 0;
  console.log(`\n📈 Overall Coverage: ${overallCoverage}%\n`);

  if (results.some(r => r.status === 0)) {
    console.log('⚠️  Some endpoints could not be tested (server not running or connection refused)\n');
  }
}

main().catch(error => {
  console.error('❌ Audit failed:', error);
  process.exit(1);
});
