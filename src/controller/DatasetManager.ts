https://tutorcs.com
WeChat: cstutorcs
QQ: 749389476
Email: tutorcs@163.com
import * as JSZip from "jszip";
import Log from "../Util";
import { Building, InsightDataset, InsightDatasetKind, GeoResponse } from "./IInsightFacade";
import { InsightError, NotFoundError, Course, DatasetDict } from "./IInsightFacade";
import * as fs from "fs-extra";
import * as parse5 from "parse5";
import * as http from "http";

export class DatasetManager {
    private courseFields: string[] = [
        "Subject", "Course", "Professor", "Title", "id", "Avg", "Pass", "Fail", "Audit", "Year",
    ];

    public datasetDict: DatasetDict;
    constructor() {
        this.datasetDict = {};
        this.loadDataset();
    }

    private parseBuildings(doc: parse5.DefaultTreeParentNode): Promise<Building[]> {
        const res: Building[] = [];
        const fn = (obj: parse5.DefaultTreeParentNode) => {
            if (Array.isArray(obj.childNodes) && obj.childNodes.length) {
                for (const childNode of obj.childNodes) {
                    if (childNode.nodeName === "tbody") {
                        const childNodes = (childNode as parse5.DefaultTreeParentNode).childNodes;
                        const tableRows = childNodes.filter((item) => item.nodeName === "tr");
                        for (const tableRow of tableRows) {
                            const tds = (tableRow as parse5.DefaultTreeParentNode).childNodes;
                            const cc = "views-field views-field-field-building-code"; // code className
                            const ac = "views-field views-field-field-building-address"; // address className
                            const tc = "views-field views-field-title"; // title className
                            const codeTd = tds.find((o: any) => o.nodeName === "td" && o.attrs[0].value === cc);
                            const code = (codeTd as any).childNodes[0].value.replace(/[\n\s]+/g, "");
                            const addressTd = tds.find((o: any) => o.nodeName === "td" && o.attrs[0].value === ac);
                            const address = (addressTd as any).childNodes[0].value.trim();
                            const titleTd = tds.find((o: any) => o.nodeName === "td" && o.attrs[0].value === tc);
                            const anchorTag = (titleTd as any).childNodes.find((o: any) => o.tagName === "a");
                            const name = anchorTag.childNodes[0].value.trim();
                            res.push({ code, address, name, lat: 0, lon: 0 });
                        }
                        break;
                    } else {
                        fn(childNode as parse5.DefaultTreeParentNode);
                    }
                }
            }
        };
        fn(doc);
        const cb = (building: Building) => {
            const baseUrl = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team252";
            const cb1 = (resolve: any) => {
                return http.get(`${baseUrl}/${encodeURIComponent(building.address)}`, (response) => {
                    let ret = "";
                    response.on("data", (data) => (ret += data));
                    response.on("end", () => (resolve(ret)));
                });
            };
            const cb2 = (data: GeoResponse) => {
                if (data && data.lon) {
                    const { lon, lat } = data;
                    building.lat = Number(lat), building.lon = Number(lon);
                }
                return building;
            };
            return new Promise(cb1).then(cb2);
        };
        return Promise.all(res.map(cb));
    }

    private parseRooms(doc: parse5.DefaultTreeParentNode, id: string, b: Building): void {
        const fn = (obj: parse5.DefaultTreeParentNode) => {
            if (Array.isArray(obj.childNodes) && obj.childNodes.length) {
                for (const childNode of obj.childNodes) {
                    if (childNode.nodeName === "tbody") {
                        const childNodes = (childNode as parse5.DefaultTreeParentNode).childNodes;
                        const tableRows = childNodes.filter((item) => item.nodeName === "tr") as any[];
                        for (const tableRow of tableRows) {
                            const tds = (tableRow as parse5.DefaultTreeParentNode).childNodes;
                            const rnc = "views-field views-field-field-room-number"; // room-number className
                            const rcc = "views-field views-field-field-room-capacity"; // room-capacity className
                            const rfc = "views-field views-field-field-room-furniture"; // room-furniture className
                            const rtc = "views-field views-field-field-room-type"; // room-type className
                            const numberTd = tds.find((o: any) => o.nodeName === "td" && o.attrs[0].value === rnc);
                            const anchorTag = (numberTd as any).childNodes.find((o: any) => o.tagName === "a");
                            const rn: string = anchorTag.childNodes[0].value.trim();
                            const rh: string = anchorTag.attrs.find((o: any) => o.name === "href").value;
                            const capacityTd = tds.find((o: any) => o.nodeName === "td" && o.attrs[0].value === rcc);
                            const rs: number = Number((capacityTd as any).childNodes[0].value.trim());
                            const furnitureTd = tds.find((o: any) => o.nodeName === "td" && o.attrs[0].value === rfc);
                            const rf: string = (furnitureTd as any).childNodes[0].value.trim();
                            const TypeTd = tds.find((o: any) => o.nodeName === "td" && o.attrs[0].value === rtc);
                            const rt: string = (TypeTd as any).childNodes[0].value.trim();
                            this.datasetDict[id].list.push({
                                room_number: rn, room_type: rt, room_furniture: rf, room_href: rh, room_seats: rs,
                                room_fullname: b.name, room_shortname: b.code, room_address: b.address,
                                room_name: `${b.code}_${rn}`, room_lat: b.lat, room_lon: b.lon,
                            });
                        }
                        break;
                    } else {
                        fn(childNode as parse5.DefaultTreeParentNode);
                    }
                }
            }
        };

        fn(doc);
    }

    /**
     * addDataset
     */
    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        if (id == null || id.split(" ").join("") === "" || id.includes("_")) {
            return Promise.reject(new InsightError("Invalid id"));
        }
        if (id in this.datasetDict) {
            return Promise.reject(new InsightError("Id already exists"));
        }
        if (kind === InsightDatasetKind.Courses) {
            const regExp = new RegExp("^courses/[^/]*$");
            if (fs.existsSync("./data")) {
                const datasets = fs.readdirSync("./data");
                datasets.forEach((element) => {
                    const dsid: string = element.split(".json")[0], path = "./data/" + element;
                    this.datasetDict[dsid] = { kind, list: fs.readJSONSync(path), };
                });
            }
            return JSZip.loadAsync(content, { base64: true })
                .then((zip) => {
                    const allFiles: Array<Promise<string>> = [];
                    for (let file of Object.values(zip.files)) {
                        if (file.dir || !regExp.test(file.name)) {
                            continue;
                        }
                        allFiles.push(file.async("string"));
                    }
                    if (allFiles.length === 0) {
                        return Promise.reject(new InsightError("Zip contains only invalid files"));
                    }
                    return Promise.all(allFiles);
                })
                .then((allFiles) => {
                    let totalSections = 0, coursesList: Course[] = [];
                    for (let file of allFiles) {
                        if (file === "") {
                            continue;
                        }
                        try {
                            const jsonData = JSON.parse(file), sections = jsonData["result"];
                            if (jsonData["rank"] === undefined) {
                                return Promise.reject(new InsightError("Invalid json without rank"));
                            }
                            for (let section of sections) {
                                if (!this.courseFields.every((ele) => Object.keys(section).indexOf(ele) !== -1)) {
                                    continue;
                                }
                                totalSections++;
                                coursesList.push({
                                    dept: section["Subject"], id: section["Course"], instructor: section["Professor"],
                                    title: section["Title"], uuid: section["id"].toString(), avg: section["Avg"],
                                    pass: section["Pass"], fail: section["Fail"], audit: section["Audit"],
                                    year: section["Section"] === "overall" ? 1900 : Number(section["Year"]),
                                });
                            }
                        } catch (err) {
                            Log.info("Invalid JSON");
                        }
                    }
                    if (totalSections === 0) {
                        return Promise.reject(new InsightError("This folder contains zero section"));
                    }
                    this.datasetDict[id] = { kind, list: coursesList, };
                    const fileName = "./data/" + id + ".json";
                    fs.outputJSONSync(fileName, coursesList);
                    return Promise.resolve(Object.keys(this.datasetDict));
                })
                .catch(() => {
                    return Promise.reject(new InsightError("Something wrong when adding sections"));
                });
        } else if (kind === InsightDatasetKind.Rooms) {
            const regExp = new RegExp("^rooms\/");
            return JSZip.loadAsync(content, { base64: true })
                .then((zip) => {
                    const zipfiles = Object.values(zip.files);
                    const doc = zipfiles.find((file) => /htm(l)?$/g.test(file.name));
                    const files = zipfiles.filter((file) => {
                        return !file.dir && file.name.includes("buildings-and-classrooms") && file.name.length > 47;
                    });
                    const promises = files.map((file) => Promise.resolve(file.async("string")));
                    const cb1 = (HTML: any) => Promise.all(promises).then((res) => cb2(res, HTML));
                    const cb2 = (res: any, HTML: any) => {
                        const obj: { [key: string]: string } = { HTML };
                        files.forEach((file, index) => {
                            obj[file.name.substr(47)] = res[index];
                        });
                        return obj;
                    };
                    return doc.async("string").then(cb1);
                })
                .then(async (allFileObj: { [key: string]: any }) => {
                    this.datasetDict[id] = { list: [], kind, };
                    if (allFileObj.HTML) {
                        const doc = parse5.parse(allFileObj.HTML);
                        return this.parseBuildings(doc as parse5.DefaultTreeParentNode)
                            .then((buildings) => ({ allFileObj, buildings }));
                    }
                    return { allFileObj, buildings: [] };
                })
                .then(({ allFileObj, buildings }) => {
                    for (let building of buildings) {
                        if (!allFileObj[building.code]) {
                            continue;
                        }
                        const rooms = parse5.parse(allFileObj[building.code]);
                        this.parseRooms(rooms as parse5.DefaultTreeParentNode, id, building);
                    }
                    return Promise.resolve(Object.keys(this.datasetDict));
                })
                .catch(() => {
                    return Promise.reject(new InsightError("Something wrong when adding sections"));
                });
        } else {
            return Promise.reject(new InsightError("Incorrect kind type"));
        }
    }

    /**
     * removeDataset
     */
    public removeDataset(id: string): Promise<string> {
        if (id == null) {
            return Promise.reject(new InsightError("Id is null"));
        }
        if (id.includes("_") || id.split(" ").join("") === "") {
            return Promise.reject(new InsightError("Id is invalid"));
        }
        if (!(id in this.datasetDict)) {
            return Promise.reject(new NotFoundError("Id doesn't exist"));
        }
        let existInDisk = false;
        if (fs.existsSync("./data")) {
            const datasets = fs.readdirSync("./data");
            datasets.forEach((element) => {
                const existingId: string = element.split(".json")[0];
                if (existingId === id) {
                    existInDisk = true;
                }
            });
        }
        if (!(id in this.datasetDict) && !existInDisk) {
            return Promise.reject("The dataset hasn't been added yet");
        }
        if (this.datasetDict[id] !== undefined) {
            delete this.datasetDict[id];
        }
        const fileName = "./data/" + id + ".json";
        fs.removeSync(fileName);
        return Promise.resolve(id);
    }

    /**
     * listDatasets
     */
    public listDatasets(): Promise<InsightDataset[]> {
        const result: InsightDataset[] = [];
        for (let datasetID in this.datasetDict) {
            result.push({
                id: datasetID,
                kind: this.datasetDict[datasetID].kind,
                numRows: this.datasetDict[datasetID].list.length,
            });
        }
        return Promise.resolve(result);
    }

    /**
     * getDatasets
     */
    public getDatasets(): any {
        return this.datasetDict;
    }

    private loadDataset() {
        if (fs.existsSync("./data")) {
            const datasets = fs.readdirSync("./data");
            datasets.forEach((element) => {
                const id: string = element.split(".json")[0];
                const path = "./data/" + element;
                this.datasetDict[id] = {
                    kind: InsightDatasetKind.Courses,
                    list: fs.readJSONSync(path),
                };
            });
        }
    }
}
