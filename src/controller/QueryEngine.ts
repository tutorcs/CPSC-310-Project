https://tutorcs.com
WeChat: cstutorcs
QQ: 749389476
Email: tutorcs@163.com
import Log from "../Util";
import { InsightError, ResultTooLargeError } from "./IInsightFacade";
import { Course, DatasetDict, Room } from "./IInsightFacade";
export class QueryEngine {
    private MCFields = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];
    private SCFields: string[] = ["dept", "id", "instructor", "title", "uuid",
        "fullname", "shortname", "number", "name", "address", "type", "furniture", "href"];

    private datasetID: string = "";
    private readonly datasetDict: DatasetDict;

    constructor(datasetDict: any) {
        this.datasetDict = datasetDict;
    }

    /**
     * performQuery
     */
    public performQuery(query: any): Promise<any[]> {
        if (query == null) {
            Log.error("query is null");
            return Promise.reject(new InsightError("Query is null"));
        }

        try {
            query = JSON.parse(JSON.stringify(query));
        } catch (e) {
            Log.error("invalid json");
            return Promise.reject(new InsightError("Invalid JSON"));
        }

        if (!this.validateSchema(query)) {
            Log.error("invalid schema");
            return Promise.reject(new InsightError("Invalid query schema"));
        }

        if (!this.validateOPTIONS(query["OPTIONS"])) {
            Log.error("invalid options");
            return Promise.reject(new InsightError("Invalid OPTIONS query"));
        }

        if (this.datasetDict[this.datasetID] === undefined) {
            return Promise.reject(new InsightError("Invalid dataset ID"));
        }

        const datasetList: Array<Course | Room> = this.datasetDict[this.datasetID].list;
        const whereClause = query["WHERE"];
        if (Object.keys(whereClause).length === 0 && datasetList.length > 5000) {
            Log.error("The result is too large");
            return Promise.reject(new ResultTooLargeError("The result is too big."));
        }

        let orderField = "";
        if (query["OPTIONS"]["ORDER"]) {
            orderField = String(query["OPTIONS"]["ORDER"].split("_")[1]);
        }

        try {
            const columns: string[] = query["OPTIONS"]["COLUMNS"];
            const result = datasetList
                .filter((dataset) => this.filterItems(dataset, whereClause))
                .sort((datasetA, datasetB) => this.sortCourse(datasetA, datasetB, orderField))
                .map((dataset) => this.mapResult(dataset, columns));
            if (result.length > 5000) {
                Log.error("The result is too large");
                return Promise.reject(new ResultTooLargeError("The result is too big."));
            }
            return Promise.resolve(result);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    private sortCourse(datasetA: Course | Room, datasetB: Course | Room, orderField: string): number {
        if (orderField === "") {
            return 0;
        }
        if (datasetA[orderField] > datasetB[orderField]) {
            return 1;
        } else if (datasetA[orderField] < datasetB[orderField]) {
            return -1;
        } else {
            return 0;
        }
    }

    private mapResult(course: Course | Room, columns: string[]): any {
        const item: { [id: string]: string | number } = {};
        columns.forEach((field) => {
            const key = field.split("_")[1];
            item[field] = course[key];
        });
        return item;
    }

    private validateSchema(query: any): boolean {
        if (Object.keys(query).length !== 2) {
            return false;
        }
        if (
            query["WHERE"] === undefined ||
            query["WHERE"] == null ||
            query["WHERE"].constructor !== Object ||
            Object.keys(query["WHERE"]).length > 1
        ) {
            return false;
        }
        return !(query["OPTIONS"] === undefined ||
            query["OPTIONS"] == null ||
            query["OPTIONS"].constructor !== Object ||
            Object.keys(query["OPTIONS"]).length === 0 ||
            Object.keys(query["OPTIONS"]).length > 2 ||
            query["OPTIONS"]["COLUMNS"] === undefined);
    }

    private validateOPTIONS(query: any): boolean {
        for (let element of Object.keys(query)) {
            if (String(element) !== "COLUMNS" && String(element) !== "ORDER") {
                return false;
            }
        }
        if (query["COLUMNS"] == null || query["COLUMNS"].constructor !== Array || query["COLUMNS"].length === 0) {
            return false;
        }
        for (let ele of query["COLUMNS"]) {
            if (typeof ele !== "string") {
                return false;
            }
            if (ele.split("_").length !== 2) {
                return false;
            }
            if (this.datasetID === "") {
                this.datasetID = ele.split("_")[0];
            } else {
                if (ele.split("_")[0] !== this.datasetID) {
                    return false;
                }
            }
            const field = ele.split("_")[1];
            if (!this.MCFields.includes(field) && !this.SCFields.includes(field)) {
                return false;
            }
        }

        if (query["ORDER"] !== undefined) {
            if (typeof query["ORDER"] !== "string") {
                return false;
            }
            if (!query["COLUMNS"].includes(query["ORDER"])) {
                return false;
            }
        }
        return true;
    }

    private validateLC(query: any): boolean {
        if (query == null || query.constructor !== Array || query.length === 0) {
            return false;
        }
        return query.every((ele: any) => ele !== null && ele.constructor === Object && Object.keys(ele).length === 1);
    }

    private validateMC(query: any): boolean {
        if (query == null || query.constructor !== Object || Object.keys(query).length !== 1) {
            return false;
        }
        if (Object.keys(query)[0].split("_")[0] !== this.datasetID) {
            return false;
        }
        if (Object.keys(query)[0].split("_").length !== 2) {
            return false;
        }
        if (!this.MCFields.includes(Object.keys(query)[0].split("_")[1])) {
            return false;
        }
        return typeof Object.values(query)[0] === "number";
    }

    private validateSC(query: any): boolean {
        if (query == null || query.constructor !== Object || Object.keys(query).length !== 1) {
            return false;
        }
        if (Object.keys(query)[0].split("_")[0] !== this.datasetID) {
            return false;
        }
        if (Object.keys(query)[0].split("_").length !== 2) {
            return false;
        }
        if (!this.SCFields.includes(Object.keys(query)[0].split("_")[1])) {
            return false;
        }
        if (typeof Object.values(query)[0] !== "string") {
            return false;
        }
        const length = String(Object.values(query)[0]).length;
        if (length > 2) {
            const subStr = String(Object.values(query)[0]).substr(1, length - 2);
            if (subStr.indexOf("*") !== -1) {
                return false;
            }
        }
        return true;
    }

    private validateNeg(query: any): boolean {
        return !(query == null || query.constructor !== Object || Object.keys(query).length !== 1);
    }

    private filterItems(course: Course | Room, query: any): boolean {
        if (Object.keys(query).length === 0) {
            return true;
        }
        const filterKey = Object.keys(query)[0];
        const criteria = query[filterKey];
        switch (filterKey) {
            case "AND": {
                if (!this.validateLC(criteria)) {
                    throw new InsightError("Invalid AND query");
                }
                return criteria.every((filter: any) => this.filterItems(course, filter));
            }
            case "OR": {
                if (!this.validateLC(criteria)) {
                    throw new InsightError("Invalid OR query");
                }
                return criteria.some((filter: any) => this.filterItems(course, filter));
            }
            case "NOT": {
                if (!this.validateNeg(criteria)) {
                    throw new InsightError("Invalid NOT query");
                }
                return !this.filterItems(course, criteria);
            }
            case "GT":
            case "EQ":
            case "LT": {
                if (!this.validateMC(criteria)) {
                    throw new InsightError("Invalid GT query");
                }
                return this.performMC(filterKey, criteria, course);
            }
            case "IS": {
                if (!this.validateSC(criteria)) {
                    throw new InsightError("Invalid IS query");
                }
                return this.performSC(criteria, course);
            }
            default:
                Log.error("Invalid filter key");
                throw new InsightError("Invalid filter key");
        }
    }

    private performMC(filterKey: string, criteria: any, dataset: Course | Room) {
        switch (filterKey) {
            case "GT": {
                const field = Object.keys(criteria)[0].split("_")[1];
                const value = Object.values(criteria)[0];
                return dataset[field] > value;
            }
            case "EQ": {
                const field = Object.keys(criteria)[0].split("_")[1];
                const value = Object.values(criteria)[0];
                return dataset[field] === value;
            }
            default: {
                const field = Object.keys(criteria)[0].split("_")[1];
                const value = Object.values(criteria)[0];
                return dataset[field] < value;
            }
        }
    }

    private performSC(criteria: any, dataset: Course | Room): boolean {
        const field = Object.keys(criteria)[0].split("_")[1];
        const value = String(Object.values(criteria)[0]);
        const regex = "^" + value.split("*").join(".*") + "$";
        const regExp = new RegExp(regex);
        return regExp.test(String(dataset[field]));
    }
}
