
    const XLSX = require('/app/frontend/node_modules/xlsx');

    const workbook = XLSX.readFile('.screenshots/pedidos_sabrositos.xlsx');
    const result = {
        sheetNames: workbook.SheetNames,
        sheets: {}
    };

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const merges = sheet['!merges'] || [];

        result.sheets[sheetName] = {
            rows: data.slice(0, 5),
            totalRows: data.length,
            merges: merges.map(m => ({
                start: { r: m.s.r, c: m.s.c },
                end: { r: m.e.r, c: m.e.c }
            }))
        };
    });

    console.log(JSON.stringify(result, null, 2));
    