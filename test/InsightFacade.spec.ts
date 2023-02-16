https://tutorcs.com
WeChat: cstutorcs
QQ: 749389476
Email: tutorcs@163.com
import { expect } from "chai";
import * as chai from "chai";
import * as fs from "fs-extra";
import * as chaiAsPromised from "chai-as-promised";
import {
    InsightDataset,
    InsightDatasetKind,
    InsightError,
    NotFoundError,
} from "../src/controller/IInsightFacade";
import InsightFacade from "../src/controller/InsightFacade";
import Log from "../src/Util";
import TestUtil from "./TestUtil";

// This should match the schema given to TestUtil.validate(..) in TestUtil.readTestQueries(..)
// except 'filename' which is injected when the file is read.
export interface ITestQuery {
    title: string;
    query: any; // make any to allow testing structurally invalid queries
    isQueryValid: boolean;
    result: any;
    filename: string; // This is injected when reading the file
}

describe("InsightFacade Add/Remove/List Dataset", function () {
    // Reference any datasets you've added to test/data here and they will
    // automatically be loaded in the 'before' hook.
    const datasetsToLoad: { [id: string]: string } = {
        courses: "./test/data/courses.zip",
        containInvalidJson: "./test/data/containInvalidJson.zip",
        containPdf: "./test/data/containPdf.zip",
        emptyFolder: "./test/data/emptyFolder.zip",
        singleInvalidJson: "./test/data/singleInvalidJson.zip",
        singlePdf: "./test/data/singlePdf.zip",
        test: "./test/data/test.pdf",
        unableUnzip: "./test/data/unableUnzip.zip",
        zeroSection: "./test/data/zeroSection.zip",
        containFolder: "./test/data/containFolder.zip",
        fourSection: "./test/data/fourSection.zip",
        wrongName: "./test/data/wrongName.zip",
        invalidWithoutRank: "./test/data/invalidWithoutRank.zip",
        rooms: "./test/data/rooms.zip"
    };
    let datasets: { [id: string]: string } = {};
    let insightFacade: InsightFacade;
    const cacheDir = __dirname + "/../data";

    before(function () {
        // This section runs once and loads all datasets specified in the datasetsToLoad object
        // into the datasets object
        Log.test(`Before all`);
        chai.use(chaiAsPromised);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir);
        }
        for (const id of Object.keys(datasetsToLoad)) {
            datasets[id] = fs
                .readFileSync(datasetsToLoad[id])
                .toString("base64");
        }
        try {
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        }
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        // This section resets the data directory (removing any cached data) and resets the InsightFacade instance
        // This runs after each test, which should make each test independent from the previous one
        Log.test(`AfterTest: ${this.currentTest.title}`);
        try {
            fs.removeSync(cacheDir);
            fs.mkdirSync(cacheDir);
            insightFacade = new InsightFacade();
        } catch (err) {
            Log.error(err);
        }
    });

    // Add Dataset
    it("Should add a valid dataset - course", function () {
        const id: string = "courses";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should add a valid dataset - room", function () {
        const id: string = "rooms";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Rooms,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should add one valid course and skip invalid json", function () {
        const id: string = "containInvalidJson";
        const expected: string[] = ["courses", id];
        return insightFacade
            .addDataset(
                "courses",
                datasets["courses"],
                InsightDatasetKind.Courses,
            )
            .then(() => {
                const futureResult: Promise<
                    string[]
                > = insightFacade.addDataset(
                    id,
                    datasets[id],
                    InsightDatasetKind.Courses,
                );
                return expect(futureResult).to.eventually.deep.equal(expected);
            });
    });

    it("Should add one valid course and one valid room", function () {
        const id1: string = "courses";
        const id2: string = "rooms";
        const expected: string[] = [id1, id2];
        return insightFacade
            .addDataset(id1, datasets[id1], InsightDatasetKind.Courses)
            .then(() => {
                const futureResult: Promise<
                    string[]
                    > = insightFacade.addDataset(
                    id2,
                    datasets[id2],
                    InsightDatasetKind.Rooms,
                );
                return expect(futureResult).to.eventually.deep.equal(expected);
            });
    });

    it("Should add one valid course and skip pdf", function () {
        const id: string = "containPdf";
        const expected: string[] = [id];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should reject to add a dataset with duplicate courses", function () {
        const id: string = "courses";
        return insightFacade
            .addDataset(id, datasets[id], InsightDatasetKind.Courses)
            .then(() => {
                const futureResult: Promise<
                    string[]
                > = insightFacade.addDataset(
                    id,
                    datasets[id],
                    InsightDatasetKind.Courses,
                );
                return expect(futureResult).to.be.rejectedWith(InsightError);
            });
    });

    it("Should reject to add a dataset with duplicate rooms", function () {
        const id: string = "rooms";
        return insightFacade
            .addDataset(id, datasets[id], InsightDatasetKind.Rooms)
            .then(() => {
                const futureResult: Promise<
                    string[]
                    > = insightFacade.addDataset(
                    id,
                    datasets[id],
                    InsightDatasetKind.Rooms,
                );
                return expect(futureResult).to.be.rejectedWith(InsightError);
            });
    });

    it("Should reject to add a dataset with a json file without rank", function () {
        const id: string = "invalidWithoutRank";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with null id", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            null,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with null content", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            null,
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with null kind", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            null,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with invalid content", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            "test",
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add empty folder", function () {
        const id: string = "emptyFolder";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with single invalid json", function () {
        const id: string = "singleInvalidJson";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with single pdf", function () {
        const id: string = "singlePdf";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add invalid dataset type", function () {
        const id: string = "test";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add zip which can't be unzipped", function () {
        const id: string = "unableUnzip";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset which contains zero section", function () {
        const id: string = "zeroSection";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with Rooms kind", function () {
        const id: string = "courses";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Rooms,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with invalid folder name", function () {
        const id: string = "wrongName";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add sections in subfolder", function () {
        const id: string = "containFolder";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should add a valid dataset with white space in id", function () {
        const id: string = "containPdf";
        const dsId: string = "empty space";
        const expected: string[] = [dsId];
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            dsId,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.eventually.deep.equal(expected);
    });

    it("Should reject to add a dataset with invalid id with underscore", function () {
        const id: string = "invalid_id";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets[id],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to add a dataset with invalid id with only whitespace characters", function () {
        const id: string = " ";
        const futureResult: Promise<string[]> = insightFacade.addDataset(
            id,
            datasets["courses"],
            InsightDatasetKind.Courses,
        );
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    // Remove Dataset
    it("Should remove courses dataset", function () {
        const id: string = "courses";
        return insightFacade
            .addDataset(id, datasets[id], InsightDatasetKind.Courses)
            .then(() => {
                const futureResult: Promise<
                    string
                > = insightFacade.removeDataset(id);
                return expect(futureResult).to.eventually.deep.equal(id);
            });
    });

    it("Should remove rooms dataset", function () {
        const id: string = "rooms";
        return insightFacade
            .addDataset(id, datasets[id], InsightDatasetKind.Rooms)
            .then(() => {
                const futureResult: Promise<
                    string
                    > = insightFacade.removeDataset(id);
                return expect(futureResult).to.eventually.deep.equal(id);
            });
    });

    it("Should reject to remove a dataset with invalid id", function () {
        const id: string = "notExist";
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(NotFoundError);
    });

    it("Should remove a dataset with invalid id containg underscore", function () {
        const id: string = "invalid_id";
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should reject to remove a dataset with null id", function () {
        const futureResult: Promise<string> = insightFacade.removeDataset(null);
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    it("Should remove a dataset with invalid id only containing whitespace character", function () {
        const id: string = " ";
        const futureResult: Promise<string> = insightFacade.removeDataset(id);
        return expect(futureResult).to.be.rejectedWith(InsightError);
    });

    // List Dataset
    it("Should list a valid courses dataset", function () {
        const id: string = "fourSection";
        const insightDataset: InsightDataset = {
            id: id,
            kind: InsightDatasetKind.Courses,
            numRows: 4,
        };
        const expectedDataset: InsightDataset[] = [insightDataset];

        return insightFacade
            .addDataset(id, datasets[id], InsightDatasetKind.Courses)
            .then(() => {
                const actualDataset: Promise<
                    InsightDataset[]
                > = insightFacade.listDatasets();
                return expect(actualDataset).to.eventually.deep.equal(
                    expectedDataset,
                );
            });
    });

    it("Should list a valid rooms dataset", function () {
        const id: string = "rooms";
        const insightDataset: InsightDataset = {
            id: id,
            kind: InsightDatasetKind.Rooms,
            numRows: 364,
        };
        const expectedDataset: InsightDataset[] = [insightDataset];

        return insightFacade
            .addDataset(id, datasets[id], InsightDatasetKind.Rooms)
            .then(() => {
                const actualDataset: Promise<
                    InsightDataset[]
                    > = insightFacade.listDatasets();
                return expect(actualDataset).to.eventually.deep.equal(
                    expectedDataset,
                );
            });
    });
});

/*
 * This test suite dynamically generates tests from the JSON files in test/queries.
 * You should not need to modify it; instead, add additional files to the queries directory.
 * You can still make tests the normal way, this is just a convenient tool for a majority of queries.
 */
describe("InsightFacade PerformQuery", () => {
    const datasetsToQuery: {
        [id: string]: { path: string; kind: InsightDatasetKind };
    } = {
        courses: {
            path: "./test/data/courses.zip",
            kind: InsightDatasetKind.Courses,
        },
    };
    let insightFacade: InsightFacade;
    let testQueries: ITestQuery[] = [];

    // Load all the test queries, and call addDataset on the insightFacade instance for all the datasets
    before(function () {
        Log.test(`Before: ${this.test.parent.title}`);

        // Load the query JSON files under test/queries.
        // Fail if there is a problem reading ANY query.
        try {
            testQueries = TestUtil.readTestQueries();
        } catch (err) {
            expect.fail(
                "",
                "",
                `Failed to read one or more test queries. ${err}`,
            );
        }

        // Load the datasets specified in datasetsToQuery and add them to InsightFacade.
        // Will fail* if there is a problem reading ANY dataset.
        const loadDatasetPromises: Array<Promise<string[]>> = [];
        insightFacade = new InsightFacade();
        for (const id of Object.keys(datasetsToQuery)) {
            const ds = datasetsToQuery[id];
            const data = fs.readFileSync(ds.path).toString("base64");
            loadDatasetPromises.push(
                insightFacade.addDataset(id, data, ds.kind),
            );
        }
        return Promise.all(loadDatasetPromises);
    });

    beforeEach(function () {
        Log.test(`BeforeTest: ${this.currentTest.title}`);
    });

    after(function () {
        Log.test(`After: ${this.test.parent.title}`);
    });

    afterEach(function () {
        Log.test(`AfterTest: ${this.currentTest.title}`);
    });

    // Dynamically create and run a test for each query in testQueries
    // Creates an extra "test" called "Should run test queries" as a byproduct. Don't worry about it
    it("Should run test queries", function () {
        describe("Dynamic InsightFacade PerformQuery tests", function () {
            for (const test of testQueries) {
                it(`[${test.filename}] ${test.title}`, function () {
                    const futureResult: Promise<
                        any[]
                    > = insightFacade.performQuery(test.query);
                    return TestUtil.verifyQueryResult(futureResult, test);
                });
            }
        });
    });
});
