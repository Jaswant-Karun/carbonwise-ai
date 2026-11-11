const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Titles & Headings in Planner
css = css.replace(
  /\.planner-page-title\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.planner-page-title {$1color: #183247;'
);

css = css.replace(
  /\.rec-title\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.rec-title {$1color: #183247;'
);

css = css.replace(
  /\.action-heading\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.action-heading {$1color: #183247;'
);

css = css.replace(
  /\.planner-section-intro\s+h2\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.planner-section-intro h2 {$1color: #183247;'
);

css = css.replace(
  /\.goal-heading\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.goal-heading {$1color: #183247;'
);

css = css.replace(
  /\.metric-main-stat\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.metric-main-stat {$1color: #183247;'
);

css = css.replace(
  /\.coach-meta\s+strong\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.coach-meta strong {$1color: #183247;'
);

css = css.replace(
  /\.modal-header\s+h2\s*\{([^}]*?)color:\s*#ffffff;/g,
  '.modal-header h2 {$1color: #183247;'
);

// 2. Timeline Day Pill
css = css.replace(
  /\.timeline-day-pill\s*\{[^}]*?\}/g,
  `.timeline-day-pill {
  display: grid;
  place-items: center;
  background: #EAF6EF;
  border: 1px solid #C6E7D6;
  border-radius: 10px;
  padding: 10px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #16845B;
}`
);

// 3. Tab Buttons
css = css.replace(
  /\.planner-tab-btn:hover\s*\{[^}]*?\}/g,
  `.planner-tab-btn:hover {
  color: #183247;
  background: #F0F4F2;
}`
);

css = css.replace(
  /\.planner-tab-btn\.active\s*\{[^}]*?\}/g,
  `.planner-tab-btn.active {
  color: #FFFFFF;
  background: #16845B;
  border-color: #16845B;
  box-shadow: 0 2px 8px rgba(22, 132, 91, 0.25);
}`
);

css = css.replace(
  /\.tab-count-pill\s*\{[^}]*?\}/g,
  `.tab-count-pill {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: #E4EBE6;
  color: #183247;
  font-weight: 700;
}`
);

css = css.replace(
  /\.planner-tab-btn\.active\s+\.tab-count-pill\s*\{[^}]*?\}/g,
  `.planner-tab-btn.active .tab-count-pill {
  background: #FFFFFF;
  color: #16845B;
}`
);

// 4. Filter Pills
css = css.replace(
  /\.filter-pill\s*\{[^}]*?\}/g,
  `.filter-pill {
  border: 1px solid #E4EBE6;
  background: #FFFFFF;
  color: #718096;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
}`
);

css = css.replace(
  /\.filter-pill:hover\s*\{[^}]*?\}/g,
  `.filter-pill:hover {
  color: #16845B;
  border-color: #16845B;
}`
);

css = css.replace(
  /\.filter-pill\.active\s*\{[^}]*?\}/g,
  `.filter-pill.active {
  background: #16845B;
  color: #FFFFFF;
  border-color: #16845B;
  box-shadow: 0 2px 8px rgba(22, 132, 91, 0.25);
}`
);

// 5. Coach Briefing Banner
css = css.replace(
  /\.planner-coach-briefing-card\s*\{[^}]*?\}/g,
  `.planner-coach-briefing-card {
  background: linear-gradient(180deg, #F0FAF5 0%, #FFFFFF 100%);
  border: 1px solid #C6E7D6;
  border-radius: 16px;
  padding: 18px 22px;
  box-shadow: 0 4px 14px rgba(24, 50, 71, 0.03);
}`
);

css = css.replace(
  /\.coach-gemini-toggle\s*\{[^}]*?\}/g,
  `.coach-gemini-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #183247;
  cursor: pointer;
  background: #FFFFFF;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #E4EBE6;
}`
);

css = css.replace(
  /\.coach-briefing-text\s*\{[^}]*?\}/g,
  `.coach-briefing-text {
  font-size: 0.85rem;
  color: #4A5568;
  line-height: 1.55;
  margin: 0;
}`
);

// 6. Target Box & Reason Box
css = css.replace(
  /\.rec-target-box\s*\{[^}]*?\}/g,
  `.rec-target-box {
  background: #F7F9F7;
  border: 1px solid #E4EBE6;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.78rem;
  margin-bottom: 12px;
}`
);

css = css.replace(
  /\.rec-target-box\s+strong\s*\{[^}]*?\}/g,
  `.rec-target-box strong {
  display: block;
  color: #183247;
  margin-bottom: 2px;
}`
);

css = css.replace(
  /\.rec-target-box\s+span\s*\{[^}]*?\}/g,
  `.rec-target-box span {
  color: #4A5568;
}`
);

css = css.replace(
  /\.rec-reason-box\s*\{[^}]*?\}/g,
  `.rec-reason-box {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}`
);

css = css.replace(
  /\.rec-reason-box\s+p\s*\{[^}]*?\}/g,
  `.rec-reason-box p {
  font-size: 0.76rem;
  color: #92400E;
  margin: 0;
  line-height: 1.4;
}`
);

// 7. Status Controls & Selects
css = css.replace(
  /\.status-dropdown-wrap\s*\{[^}]*?\}/g,
  `.status-dropdown-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #F7F9F7;
  border: 1px solid #E4EBE6;
  border-radius: 8px;
  padding: 6px 10px;
}`
);

css = css.replace(
  /\.status-select\s*\{[^}]*?\}/g,
  `.status-select {
  background: transparent;
  border: none;
  color: #183247;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  width: 100%;
}`
);

css = css.replace(
  /\.status-select\s+option\s*\{[^}]*?\}/g,
  `.status-select option {
  background: #FFFFFF;
  color: #183247;
}`
);

// 8. Goal Modal & Inputs
css = css.replace(
  /\.modal-backdrop\s*\{[^}]*?\}/g,
  `.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(24, 50, 71, 0.45);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 20px;
}`
);

css = css.replace(
  /\.modal-content\.goal-modal\s*\{[^}]*?\}/g,
  `.modal-content.goal-modal {
  background: #FFFFFF;
  border: 1px solid #E4EBE6;
  border-radius: 18px;
  width: 100%;
  max-width: 480px;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(24, 50, 71, 0.15);
}`
);

css = css.replace(
  /\.form-group\s+label\s*\{[^}]*?\}/g,
  `.form-group label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #183247;
}`
);

css = css.replace(
  /\.form-group\s+select,\s*\.form-group\s+input\s*\{[^}]*?\}/g,
  `.form-group select,
.form-group input {
  background: #F7F9F7;
  border: 1px solid #E4EBE6;
  color: #183247;
  font-size: 0.85rem;
  padding: 10px 12px;
  border-radius: 10px;
  outline: none;
}`
);

css = css.replace(
  /\.form-group\s+select:focus,\s*\.form-group\s+input:focus\s*\{[^}]*?\}/g,
  `.form-group select:focus,
.form-group input:focus {
  border-color: #16845B;
  background: #FFFFFF;
}`
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('✅ Updated index.css successfully with White SaaS theme rules!');
