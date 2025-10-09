import { ok, badRequest } from 'wix-http-functions';
import wixData from "wix-data";

export async function get_salesData(request) {
    try {
        // Get query parameters for start and end date
        const startDateStr = request.query.start;
        const endDateStr = request.query.end;

        // Validate that both parameters exist
        if (!startDateStr || !endDateStr) {
            return badRequest({
                body: {
                    error: 'Missing required parameters',
                    message: 'Both start and end date parameters are required',
                    example: '?start=01-09-2025&end=04-10-2025',
                    format: 'DD-MM-YYYY'
                }
            });
        }

        // Validate date format using regex (DD-MM-YYYY)
        const dateFormatRegex = /^(\d{2})-(\d{2})-(\d{4})$/;

        if (!dateFormatRegex.test(startDateStr)) {
            return badRequest({
                body: {
                    error: 'Invalid start date format',
                    message: `"${startDateStr}" is not in DD-MM-YYYY format`,
                    expected: 'DD-MM-YYYY',
                    example: '01-09-2025'
                }
            });
        }

        if (!dateFormatRegex.test(endDateStr)) {
            return badRequest({
                body: {
                    error: 'Invalid end date format',
                    message: `"${endDateStr}" is not in DD-MM-YYYY format`,
                    expected: 'DD-MM-YYYY',
                    example: '04-10-2025'
                }
            });
        }

        // Convert string dates to Date objects with error handling
        let startDateTime, endDateTime;
        try {
            startDateTime = parseDDMMYYYY(startDateStr);
            endDateTime = parseDDMMYYYY(endDateStr);
        } catch (parseError) {
            return badRequest({
                body: {
                    error: 'Date parsing error',
                    message: parseError.message,
                    format: 'DD-MM-YYYY',
                    example: '?start=01-09-2025&end=04-10-2025'
                }
            });
        }

        // Check if dates are actually valid (e.g., not 31-02-2025)
        if (isNaN(startDateTime.getTime())) {
            return badRequest({
                body: {
                    error: 'Invalid start date',
                    message: `"${startDateStr}" is not a valid calendar date`,
                    example: 'Valid: 01-09-2025, Invalid: 31-02-2025'
                }
            });
        }

        if (isNaN(endDateTime.getTime())) {
            return badRequest({
                body: {
                    error: 'Invalid end date',
                    message: `"${endDateStr}" is not a valid calendar date`,
                    example: 'Valid: 04-10-2025, Invalid: 31-02-2025'
                }
            });
        }

        // Validate that start date is not after end date
        if (startDateTime > endDateTime) {
            return badRequest({
                body: {
                    error: 'Invalid date range',
                    message: 'Start date cannot be after end date',
                    startDate: startDateStr,
                    endDate: endDateStr
                }
            });
        }

        // Validate date range is not too large (optional, prevents abuse)
        // FIX: Use .getTime() to convert Date to number
        const daysDifference = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDifference > 730) { // 2 years maximum
            return badRequest({
                body: {
                    error: 'Date range too large',
                    message: 'Date range cannot exceed 2 years (730 days)',
                    requestedDays: Math.round(daysDifference),
                    maxDays: 730
                }
            });
        }

        // Set end date to end of day (23:59:59.999)
        endDateTime.setHours(23, 59, 59, 999);

        // Query orders with date filter
        const ordersResult = await wixData.query("Stores/Orders")
            .ge("_dateCreated", startDateTime)
            .le("_dateCreated", endDateTime)
            .find({ suppressAuth: true });

        // Calculate total purchases (number of orders)
        const totalPurchases = ordersResult.totalCount;

        // Calculate total revenue using actual amount paid
        const totalRevenue = ordersResult.items.reduce((sum, order) => {
            return sum + (order.totals?.total || 0);
        }, 0);

        // Return formatted data
        return ok({
            body: {
                purchases: totalPurchases,
                revenue: parseFloat(totalRevenue.toFixed(2)),
            }
        });
        // return ok({
        //     body: {
        //         startDate: startDateStr,
        //         endDate: endDateStr,
        //         totalPurchases: totalPurchases,
        //         totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        //         currency: ordersResult.items[0]?.currency || 'EUR',
        //         dateRange: {
        //             days: Math.round(daysDifference) + 1
        //         }
        //     }
        // });

    } catch (error) {
        console.error('Error fetching sales data:', error);
        return badRequest({
            body: {
                error: 'Internal server error',
                message: error.message
            }
        });
    }
}

// Parse DD-MM-YYYY format
function parseDDMMYYYY(dateStr) {
    const parts = dateStr.split('-');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JS
    const year = parseInt(parts[2], 10);

    // Validate day range (1-31)
    if (day < 1 || day > 31) {
        throw new Error(`Invalid day: ${day}. Day must be between 1 and 31`);
    }

    // Validate month range (1-12)
    if (month < 0 || month > 11) {
        throw new Error(`Invalid month: ${parts[1]}. Month must be between 1 and 12`);
    }

    // Validate year range (reasonable business dates)
    if (year < 2000 || year > 2100) {
        throw new Error(`Invalid year: ${year}. Year must be between 2000 and 2100`);
    }

    return new Date(year, month, day);
}