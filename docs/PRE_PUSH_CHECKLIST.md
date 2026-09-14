# Pre-Push Checklist — Quality Gate

الموقع الحي يُنشر فقط إذا نجح **Quality Gate** ثم **Deploy engine pages**.

التعديل على `main` بدون Gate أخضر = الملفات على GitHub تتحدث، لكن **GitHub Pages لا يتحدث**.

## قبل أي push إلى main

### 1) لا تلمس العقود المحمية
- [ ] لا تغيير منطق Supabase / RPC / NAV / SmartScore / benchmarks
- [ ] لا حذف سكربتات `fund.html` أو إعادة ترتيبها عشوائيًا

### 2) عقد Fund DNA (حرج)
`web/fund.html` يجب أن يحتوي بهذا الترتيب:

1. `js/data/supabase-client.js`
2. `js/data/fund-service.js`
3. `js/fund-core.js`
4. `js/fund-performance.js`
5. `js/fund-risk.js`
6. `js/fund-benchmark.js`
7. `js/fund-smartscore.js`
8. `js/fund-evidence.js`
9. `js/fund-profile.js`
10. `js/fund-tabs.js`

فحص محلي:
```bash
python scripts/verify_financial_contracts.py
```

### 3) JavaScript
```bash
for f in web/js/*.js web/js/data/*.js; do node --check "$f"; done
python scripts/check_inline_js.py
```

### 4) Build / baseline
```bash
python scripts/verify_baseline.py
node scripts/build_check.mjs
```

### 5) الهوية البصرية (Experience Layer)
- [ ] الألوان والخطوط والحالات من `web/css/khater-design-system.css` فقط
- [ ] ملفات `page-*.css` = layout فقط (بدون هوية منافسة)
- [ ] لا ثيم dark / terminal
- [ ] لا إعادة تعريف `--nile-*` في صفحات منفصلة

### 6) بعد الـpush
- [ ] Actions: **Quality Gate = success**
- [ ] Actions: **Deploy engine pages = success**
- [ ] تحقق من الرابط الحي: `https://khater1984.github.io/Khater-data/`
- [ ] Hard refresh (`Ctrl+Shift+R`) قبل الحكم على النتيجة

## القاعدة الذهبية

> لم يُنشر التغيير إلا إذا كان Gate أخضر **و** Pages محدّث.
