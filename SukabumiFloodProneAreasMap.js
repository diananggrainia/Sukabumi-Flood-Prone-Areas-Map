//Import data
var sukabumi = ee.FeatureCollection("projects/ee-diananggraini2203/assets/Kab_Sukabumi");
var sukabumi_polyline = ee.FeatureCollection("projects/ee-diananggraini2203/assets/kab_garis");
var river = ee.Image("projects/ee-diananggraini2203/assets/sungai_polygon_pl").clip(sukabumi);
var curah_hujan = ee.Image("projects/ee-diananggraini2203/assets/curah_hujan_sukabumi").clip(sukabumi);
var fabdem = ee.Image("projects/ee-diananggraini2203/assets/FABDEM_SK").clip(sukabumi);

//Load dataset
var lulc = ee.ImageCollection("ESA/WorldCover/v200").mosaic().select('Map').clip(sukabumi);
var soil = ee.Image("OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02").select('b0').clip(sukabumi);


//Membuat hillshade
var hillshade = ee.Terrain.hillshade(fabdem).clip(sukabumi);


//Klasifikasi & scoring parameter banjir
//Sungai (diawali dengan membuat buffer)
var riverDistance = river.fastDistanceTransform().sqrt().multiply(30).clip(sukabumi);
var bufferClass = riverDistance.expression(
  "(b(0) <= 25) ? 5" +
  ": (b(0) > 25 && b(0) <= 50) ? 4" +  
  ": (b(0) > 50 && b(0) <= 75) ? 3" +  
  ": (b(0) > 75 && b(0) <= 100) ? 2" +  
  ": 1"
).clip(sukabumi);

//Penggunaan lahan
var lulcClass = lulc.remap( 
  [80, 50, 40, 20, 30, 60, 10], 
  [5, 4, 3, 2, 2, 2, 1]
  ).clip(sukabumi);

//Tanah
var soilClass = soil.remap(
  [1,2,3,4,5,6,7,8,9,10,11,12],  
  [1,1,2,2,3,3,4,4,5,5,5,5]       
).clip(sukabumi);

//Curah hujan  
var rainfallClass2 = curah_hujan.remap(
  [0,1,2,3],
  [2,3,1,4]).clip(sukabumi);

//Ketinggian permukaan
var fabdemClass = fabdem.expression(
  "(b(0) <= 25) ? 5" +
  ": (b(0) > 25 && b(0) <= 75) ? 4" +
  ": (b(0) > 75 && b(0) <= 150) ? 3" +
  ": (b(0) > 150 && b(0) <= 250) ? 2" +
  ": 1"
).clip(sukabumi);

//Kemiringan lereng (diawali dengan membuat kemiringan lereng dari data elevasi diatasnya)
var slope = ee.Terrain.slope(fabdem).rename('Slope').clip(sukabumi);
var slopeClass = slope.expression(
  "(b(0) <= 8) ? 5" +
  ": (b(0) > 8 && b(0) <= 15) ? 4" +
  ": (b(0) > 15 && b(0) <= 25) ? 3" +
  ": (b(0) > 25 && b(0) <= 40) ? 2" +
  ": 1"
).clip(sukabumi);


//Proses MCA (pembobotan dan overlay parameter banjir)
var floodProne = bufferClass.multiply(23)
  .add(rainfallClass.multiply(19))
  .add(soilClass.multiply(18))
  .add(slopeClass.multiply(17))
  .add(fabdemClass.multiply(15))
  .add(lulcClass.multiply(8))
  .clip(sukabumi);


//Menampilkan nilai hasil MCA
var stats = floodProne.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: sukabumi,       
  scale: 30,                
  maxPixels: 1e13
});
print("Min dan Max Flood Hazard Score:", stats);


//Klasifikasi kerawanan banjir
var floodProneClass = floodProne.expression(
  "(b(0) <= 272) ? 1" +                     // Rendah
  ": (b(0) > 272 && b(0) <= 368) ? 2" +     // Sedang
  ": 3"                                     // Tinggi
);


//Visualisasi kelas kerawanan banjir
var visParamsClass = {
  min: 1, max: 3,
  palette: ['green', 'yellow', 'red']
};


//Visualisasi hillshade
var visHillshade = {min: 0, max: 255, palette: ['000000', 'FFFFFF']};


//Visualisasi parameter banjir
//Sungai
var visParamsBuffer = {
  min: 1, max: 5,
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
};
//Penggunaan lahan
var visParamsLULC = {
  min: 1, max: 5,
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
};
//Tanah
var visParamsSoil = {
  min: 1, max: 5,
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
};
//Curah hujan
var visParamsRainfall = {
  min: 1, max: 5,
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
};
//Ketinggian permukaan
var visParamsElevation = {
  min: 1, max: 5,
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
};
//Kemiringan lereng
var visParamsSlope = {
  min: 1, max: 5,
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
};



//---Mengatur tampilan hillshade pada data kerawanan banjir----
//Mengubah data kerawanan banjir menjadi tampilan RGB
var floodRGB = floodProneClass.visualize(visParamsClass);

//Menormalisasikan data hillshade untuk efek pencahayaan (0-1)
var hillshadeNorm = hillshade.divide(255).clip(sukabumi);

//Memisahkan RGB pada 'floodRGB'
var floodRed = floodRGB.select('vis-red').multiply(hillshadeNorm);
var floodGreen = floodRGB.select('vis-green').multiply(hillshadeNorm);
var floodBlue = floodRGB.select('vis-blue').multiply(hillshadeNorm);

//Menggambungkan kembali menjadi citra RGB dengan efek hillshade
var blended = ee.Image.rgb(floodRed, floodGreen, floodBlue);



//---Membuat panel Layer data----
//Membuat panel kontrol
var controlPanel = ui.Panel({
  style: {
    position: 'top-left',
    padding: '8px',
    backgroundColor: 'white'
  }
});

//Menambahkan judul panel
controlPanel.add(ui.Label({
  value: 'Layer Data',
  style: { fontWeight: 'bold', fontSize: '14px', margin: '4px' }
}));

//Menyembunyikan panel saat awal aplikasi dibuka
controlPanel.style().set('shown', false);



//---Membuat panel legenda---
//Membuat kontrol panel
var legendPanel = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px',
    backgroundColor: 'white'
  }
});
legendPanel.style().set('shown', false);

//Membuat legenda berdasarkan hasil visualisasi data
function createLegend(title, colors, labels) {
  var panel = ui.Panel();
  panel.add(ui.Label({value: title, style: {fontWeight: 'bold'}}));
  for (var i = 0; i < colors.length; i++) {
    var colorBox = ui.Label({style: {backgroundColor: colors[i], padding: '8px', margin: '4px'}});
    var label = ui.Label(labels[i]);
    var legendRow = ui.Panel({widgets: [colorBox, label], layout: ui.Panel.Layout.Flow('horizontal')});
    panel.add(legendRow);
  }
  return panel;
}

//Membuat informasi dalam legenda
var legends = {
  'Kerawanan Banjir': createLegend('Kerawanan Banjir', ['green', 'yellow', 'red'], ['Rendah', 'Sedang', 'Tinggi']),
  'Kabupaten': createLegend('Batas Administrasi Wilayah', ['black'], ['Kabupaten']),
  'Penggunaan Lahan': createLegend('Penggunaan Lahan', ['blue', 'cyan', 'yellow', 'orange', 'red'], ['Sangat Rendah [Hutan]', 'Rendah [Semak & Lahan Terbuka]', 'Sedang [Lahan Pertanian]', 'Tinggi [Lahan Terbangun]', 'Sangat Tinggi [Tubuh Air]']),
  'Tanah': createLegend('Tanah', ['blue', 'cyan', 'yellow', 'orange', 'red'], ['Sangat Rendah [Sand & Loamy Sand]', 'Rendah [Sandy Loam & Loam]', 'Sedang [Silt Loam & Silt]', 'Tinggi [Clay Loam & Silt Clay Loam]', 'Sangat Tinggi [Clay, Silty Clay, Heavy Clay, & Vertisol]']),
  'Ketinggian Permukaan': createLegend('Ketinggian Permukaan', ['blue', 'cyan', 'yellow', 'orange', 'red'], ['Sangat Rendah [>250 mdpl]', 'Rendah [150-250 mdpl]', 'Sedang [75-150 mdpl]', 'Tinggi [25-75 mdpl]', 'Sangat Tinggi [<25 mdpl]']),
  'Kemiringan Lereng': createLegend('Kemiringan Lereng', ['blue', 'cyan', 'yellow', 'orange', 'red'], ['Sangat Rendah [>40%]', 'Rendah [25-40%]', 'Sedang [15-25%]', 'Tinggi [8-15%]', 'Sangat Tinggi [<8%]']),
  'Jarak Sungai': createLegend('Jarak Sungai', ['blue', 'cyan', 'yellow', 'orange', 'red'], ['Sangat Rendah [>100 m]', 'Rendah [75-100 m]', 'Sedang [50-75 m]', 'Tinggi [25-50 m]', 'Sangat Tinggi [0-25 m]']),
  'Curah Hujan': createLegend('Curah Hujan', ['blue', 'cyan', 'yellow', 'orange', 'red'], ['Sangat Rendah [<20 mm]', 'Rendah [20-100 mm]', 'Sedang [100-300 mm]', 'Tinggi [300-500 mm]', 'Sangat Tinggi [>500 mm]'])
};

//Memberbarui tampilan legenda berdasarkan data yg dipilih dengan checkbox
function updateLegend() {
  legendPanel.clear();
  var anyChecked = false;
  controlPanel.widgets().forEach(function(widget) {
    if (widget instanceof ui.Checkbox && widget.getValue()) {
      legendPanel.add(legends[widget.getLabel()]);
      anyChecked = true;
    }
  });
  legendPanel.style().set('shown', anyChecked);
}



//---Membuat checkbox data pada panel Layer Data
function createLayerCheckbox(label, layer, visParams) {
  var checkbox = ui.Checkbox({
    label: label,
    value: false,
    onChange: function(checked) {
      if (checked) {
        Map.addLayer(layer, visParams, label);
      } else {
        Map.layers().forEach(function(l) {
          if (l.getName() === label) {
            Map.layers().remove(l);
          }
        });
      }
      updateLegend();
    }
  });
  controlPanel.add(checkbox);
}

// Menambahkan sub-judul dan checkbox
controlPanel.add(ui.Label({
  value: 'Batas Administrasi Wilayah',
  style: { fontWeight: 'bold', fontSize: '12px', margin: '4px' }
}));

createLayerCheckbox('Kabupaten', sukabumi_polyline, {});
controlPanel.add(ui.Label({
  value: 'Parameter Kerawanan Banjir',
  style: { fontWeight: 'bold', fontSize: '12px', margin: '4px' }
}));
createLayerCheckbox('Penggunaan Lahan', lulcClass, visParamsLULC);
createLayerCheckbox('Tanah', soilClass, visParamsSoil);
createLayerCheckbox('Ketinggian Permukaan', fabdemClass, visParamsElevation);
createLayerCheckbox('Kemiringan Lereng', slopeClass, visParamsSlope);
createLayerCheckbox('Jarak Sungai', bufferClass, visParamsBuffer);
createLayerCheckbox('Curah Hujan', rainfallClass2, visParamsRainfall);
controlPanel.add(ui.Label({
  value: 'Kerawanan Banjir',
  style: { fontWeight: 'bold', fontSize: '12px', margin: '4px' }
}));
createLayerCheckbox('Kerawanan Banjir', blended);

//Menambahkan tombol untuk menutup panel
var closeButton = ui.Button({
  label: 'Tutup',
  onClick: function() {
    controlPanel.style().set('shown', false);
    //legendPanel.style().set('shown', false);
  }
});
controlPanel.add(closeButton);

// Menambahkan panel Layer Data dan Legenda ke peta
Map.add(controlPanel);
Map.add(legendPanel);



//---Membuat panel informasi
//Menambahkan panel posisi vertikal di sebelah kanan tampilan peta
var sidePanel = ui.Panel({
  style: {position: 'top-right', width: '450px', padding: '10px', textAlign: 'center'}
});
sidePanel.add(ui.Label({
  value: 'SUKABUMI FLOOD PRONE AREAS MAP',
  style: {fontWeight: 'bold', fontSize: '22px', textAlign: 'center', color: '#344CB7'}
}));


//Membuat komponen deskripsi singkat aplikasi
var infoText4 = ui.Label({
  value: 'Earth Engine Apps: Area Rawan Banjir Kabupaten Sukabumi dirancang dan dikembangkan untuk memvisualisasikan peta interaktif area rawan banjir di Kabupaten Sukabumi. Pendekatan Multi Criteria Analysis (MCA) dimanfaatkan sebagai metode dalam penentuan tingkat kerawanan banjir dengan mengintegrasikan parameter kerawanan banjir, seperti ketinggian permukaan bumi (elevasi), kemiringan lereng (slope), penggunaan lahan, jenis tanah, jarak jangkauan sungai, dan curah hujan melalui scoring, pembobotan, dan overlay. Pengolahan data dan pengintegrasian sistem Earth Engine Apps dilakukan dalam Google Earth Engine dengan bahasa pemrograman JavaScript. Aplikasi ini memungkinkan pengguna untuk memahami dan mengeksplorasi distribusi area rawan banjir di Kabupaten Sukabumi secara interaktif.',
  style: {textAlign: 'justify', margin: '15px', fontSize:'16px'}
});
sidePanel.add(infoText4);


//Membuat komponen Informasi Penggunaan Aplikasi
var infoText = ui.Label({
  value: '1. Fitur “Informasi Penggunaan Aplikasi” berisi informasi cara penggunaan aplikasi beserta fitur-fitur yang ada di dalamnya.\n' +
         '2. Fitur “Informasi Pengolahan Data” berisi informasi terkait data-data yang digunakan dalam pengolahan dan metode yang digunakan untuk mengolah data.\n' +
         '3. Fitur “Layer Data” berisi informasi terkait layer-layer data yang dapat ditampilkan pada peta.\n' +
         '4. Fitur checkbox pada layer data untuk menampilkan layer data pada peta beserta legendanya.\n' +
         '5. Fitur “Tutup” pada panel layer data untuk menutup tampilan layer data.\n' +
         '6. Fitur “Zoom In” untuk memperbesar tampilan peta dan “Zoom Out” untuk memperkecil tampilan peta.\n' +
         '7. Fitur “Fullscreen View” untuk memperbesar tampilan aplikasi.\n' +
         '8. Fitur basemap untuk mengubah tampilan basemap pada peta.',
  style: {
    textAlign: 'justify',
    margin: '15px',
    whiteSpace: 'pre-wrap',
    shown: false
  }
});

var toggleButton = ui.Button({
  label: 'Informasi Penggunaan Aplikasi',
  onClick: function() {
    var isVisible = infoText.style().get('shown');
    infoText.style().set('shown', !isVisible);
    toggleButton.setLabel(isVisible ? 'Informasi Penggunaan Aplikasi' : 'Tutup');
  },
  style: {
    width: 'calc(100% - 20px)',
    textAlign: 'center'
  }
});

sidePanel.add(toggleButton);
sidePanel.add(infoText);


//Membuat komponen Informasi Pengolahan Data
var infoText2 = ui.Label({
  value: 'Data:\n' +
         '1. Data Batas Administrasi Kab. Sukabumi\n' +
         '2. Data Ketinggian Permukaan Bumi\n' +
         '3. Data Kemiringan Lereng\n' +
         '4. Data Curah Hujan\n' +
         '5. Data Penggunaan Lahan\n' +
         '6. Data Jenis Tanah\n' +
         '7. Data Jaringan Sungai\n\n' +
         'Metode:\n' +
         '1. Parameter ketinggian permukaan bumi (elevasi), kemiringan lereng (slope), penggunaan lahan, jenis tanah, jarak jangkauan sungai, dan curah hujan diklasifikasikan dan diberikan nilai berdasarkan tingkat pengaruhnya terhadap banjir.\n' +
         '2. Pendekatan Multi Criteria Analysis (MCA) digunakan sebagai metode utama dalam penentuan tingkat kerawanan banjir melalui pembobotan dan overlay parameter penyebab banjir.\n' +
         '3. Tingkat kerawanan banjir diklasifikasikan ke dalam 3 kelas kerawanan, yaitu rendah, sedang, dan tinggi.\n' +
         '4. Hasil pemodelan dan pemetaan area rawan banjir disajikan dalam peta interaktif Earth Engine Apps.',
  style: {
    textAlign: 'justify',
    margin: '15px',
    whiteSpace: 'pre-wrap',
    shown: false
  }
});

var toggleButton2 = ui.Button({
  label: 'Informasi Pengolahan Data',
  onClick: function() {
    var isVisible = infoText2.style().get('shown');
    infoText2.style().set('shown', !isVisible);
    toggleButton2.setLabel(isVisible ? 'Informasi Pengolahan Data' : 'Tutup');
  },
  style: {
    width: 'calc(100% - 20px)',// Membuat tombol mengisi seluruh lebar panel
    textAlign: 'center' // Teks tetap di tengah
  }
});
sidePanel.add(toggleButton2);
sidePanel.add(infoText2);


//Membuat komponen Informasi Layer Data
var toggleButton4 = ui.Button({
  label: 'Informasi Layer Data',
  onClick: function() {
    controlPanel.style().set('shown', true);
  },
  style: {
    width: 'calc(100% - 20px)',// Membuat tombol mengisi seluruh lebar panel
    textAlign: 'center' // Teks tetap di tengah
  }
});

var panel4 = ui.Panel({
  widgets: [toggleButton4],
  layout: ui.Panel.Layout.flow('vertical')
});

sidePanel.add(panel4);
ui.root.add(sidePanel);


//Membuat komponen Informasi Credit
var infoText5 = ui.Label({
  value: 'Credits:',
  style: {fontWeight: 'bold', textAlign: 'justify', fontSize: '12px'}
});
sidePanel.add(infoText5);

var infoText6 = ui.Panel([
  ui.Label({
    value: '© Developed by Dian Anggraini Astuti',
    style: {textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: '12px'}
  }),
  ui.Label({
    value: 'dian.anggraini2203@mail.ugm.ac.id',
    targetUrl: 'mailto:dian.anggraini2203@mail.ugm.ac.id',
    style: {textAlign: 'left', color: 'blue', textDecoration: 'underline', fontSize: '12px'}
  }),
  ui.Label({
    value: 'PROGRAM STUDI SARJANA TERAPAN\n' +
         'SISTEM INFORMASI GEOGRAFIS\n' +
         'DEPARTEMEN TEKNOLOGI KEBUMIAN\n' +
         'SEKOLAH VOKASI\n' +
         'UNIVERSITAS GADJAH MADA\n' +
         'YOGYAKARTA\n' +
         '2025',
  style: {
    textAlign: 'center',
    whiteSpace: 'pre-wrap', // Agar teks tetap terformat dengan baik
    fontSize: '15px',
    fontWeight: 'bold',
    stretch: 'horizontal'
  }
  })
]);
sidePanel.add(infoText6);



//Mengubah Tampilan Basemap (ketika app pertama kali di run)
Map.setOptions('SATELLITE');

//Menonaktifkan Drawing Tools
Map.drawingTools().setShown(false);

//Menambahkan Hasil ke Peta
Map.centerObject(sukabumi, 10);

