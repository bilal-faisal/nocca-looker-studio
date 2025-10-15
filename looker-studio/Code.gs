/**
 * Wix Sales - Looker Studio Community Connector (Simplified)
 */

var WIX_SALES_API_URL = 'https://www.nocca-ehms.com/_functions/salesData';

function getAuthType() {
  var cc = DataStudioApp.createCommunityConnector();
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.NONE)
    .build();
}

function isAdminUser() {
  return true;
}

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();
  config.setDateRangeRequired(true);
  config.newInfo()
    .setId('info')
    .setText('Fetches Wix sales data for the selected date range.');
  return config.build();
}

function getSchema(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;

  // Metrics only - super simple
  fields.newMetric()
    .setId('purchases')
    .setName('Total Purchases')
    .setType(types.NUMBER)
    .setAggregation(aggregations.SUM);

  fields.newMetric()
    .setId('revenue')
    .setName('Total Revenue')
    .setType(types.CURRENCY_EUR)
    .setAggregation(aggregations.SUM);

  return { schema: fields.build() };
}

// function getData(request) {
//   var cc = DataStudioApp.createCommunityConnector();

//   try {
//     // Log the incoming request
//     Logger.log('Incoming dateRange: ' + JSON.stringify(request.dateRange));

//     var startDateRaw = request.dateRange.startDate;
//     var endDateRaw = request.dateRange.endDate;

//     Logger.log('Start date raw: ' + startDateRaw);
//     Logger.log('End date raw: ' + endDateRaw);

//     var startDate = formatDateForAPI(startDateRaw);
//     var endDate = formatDateForAPI(endDateRaw);

//     Logger.log('Start date formatted: ' + startDate);
//     Logger.log('End date formatted: ' + endDate);

//     var apiData = fetchDataFromWix(startDate, endDate);

//     var values = [];
//     request.fields.forEach(function (field) {
//       switch (field.name) {
//         case 'purchases':
//           values.push(apiData.purchases || 0);
//           break;
//         case 'revenue':
//           values.push(apiData.revenue || 0);
//           break;
//       }
//     });

//     return {
//       schema: getSchema().schema,
//       rows: [{ values: values }]
//     };

//   } catch (e) {
//     cc.newUserError()
//       .setDebugText('Error: ' + e.toString())
//       .setText('Error fetching data: ' + e.message)
//       .throwException();
//   }
// }

function getData(request) {
  var cc = DataStudioApp.createCommunityConnector();
  
  try {
    var startDate = formatDateForAPI(request.dateRange.startDate);
    var endDate = formatDateForAPI(request.dateRange.endDate);
    
    Logger.log('Fetching data for: ' + startDate + ' to ' + endDate);
    
    var apiData = fetchDataFromWix(startDate, endDate);
    
    Logger.log('API returned: ' + JSON.stringify(apiData));
    
    // Build the requested schema (only fields that were requested)
    var requestedFields = cc.getFields();
    var types = cc.FieldType;
    var aggregations = cc.AggregationType;
    
    request.fields.forEach(function(field) {
      switch(field.name) {
        case 'purchases':
          requestedFields.newMetric()
            .setId('purchases')
            .setName('Total Purchases')
            .setType(types.NUMBER)
            .setAggregation(aggregations.SUM);
          break;
        case 'revenue':
          requestedFields.newMetric()
            .setId('revenue')
            .setName('Total Revenue')
            .setType(types.CURRENCY_EUR)
            .setAggregation(aggregations.SUM);
          break;
      }
    });
    
    // Build values array in the exact order requested
    var values = [];
    
    for (var i = 0; i < request.fields.length; i++) {
      var fieldName = request.fields[i].name;
      
      switch(fieldName) {
        case 'purchases':
          values.push(apiData.purchases || 0);
          break;
        case 'revenue':
          values.push(apiData.revenue || 0);
          break;
        default:
          values.push(0);
      }
    }
    
    Logger.log('Requested ' + request.fields.length + ' fields, returning ' + values.length + ' values');
    Logger.log('Values: ' + JSON.stringify(values));
    
    return {
      schema: requestedFields.build(),
      rows: [{ values: values }]
    };
    
  } catch (e) {
    cc.newUserError()
      .setDebugText('Error: ' + e.toString() + ' | Stack: ' + (e.stack || 'N/A'))
      .setText('Error fetching data: ' + e.message)
      .throwException();
  }
}

// function formatDateForAPI(dateString) {
//   // Convert YYYYMMDD to DD-MM-YYYY
//   var year = dateString.substring(0, 4);
//   var month = dateString.substring(4, 6);
//   var day = dateString.substring(6, 8);
//   return day + '-' + month + '-' + year;
// }

function formatDateForAPI(dateString) {
  // Looker Studio sends dates in YYYY-MM-DD format (e.g., "2025-10-02")
  // We need to convert to DD-MM-YYYY format (e.g., "02-10-2025")

  if (!dateString || typeof dateString !== 'string') {
    throw new Error('Invalid date: ' + dateString);
  }

  // Handle YYYY-MM-DD format (with dashes)
  if (dateString.indexOf('-') > -1) {
    var parts = dateString.split('-');
    if (parts.length === 3) {
      var year = parts[0];
      var month = parts[1];
      var day = parts[2];
      return day + '-' + month + '-' + year;
    }
  }

  // Handle YYYYMMDD format (no dashes) - fallback
  if (dateString.length === 8) {
    var year = dateString.substring(0, 4);
    var month = dateString.substring(4, 6);
    var day = dateString.substring(6, 8);
    return day + '-' + month + '-' + year;
  }

  throw new Error('Unsupported date format: ' + dateString);
}

function fetchDataFromWix(startDate, endDate) {
  var url = WIX_SALES_API_URL + '?start=' + startDate + '&end=' + endDate;
  var response = UrlFetchApp.fetch(url);
  return JSON.parse(response.getContentText());
}

/**
 * Test function
 */
function testNewAPI() {
  var startDate = '08-05-2025';
  var endDate = '08-10-2025';

  var url = WIX_SALES_API_URL + '?start=' + startDate + '&end=' + endDate;
  Logger.log('Testing URL: ' + url);

  var response = UrlFetchApp.fetch(url);
  var data = JSON.parse(response.getContentText());

  Logger.log('Response: ' + JSON.stringify(data));
  Logger.log('Purchases: ' + data.purchases);
  Logger.log('Revenue: ' + data.revenue);
}