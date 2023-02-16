https://tutorcs.com
WeChat: cstutorcs
QQ: 749389476
Email: tutorcs@163.com
import Log from "../Util";
import { IInsightFacade, InsightDataset, InsightDatasetKind } from "./IInsightFacade";
import { QueryEngine } from "./QueryEngine";
import { DatasetManager } from "./DatasetManager";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
    private queryEngine: QueryEngine;
    private datasetManager: DatasetManager;

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
        this.datasetManager = new DatasetManager();
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        return this.datasetManager.addDataset(id, content, kind);
    }

    public removeDataset(id: string): Promise<string> {
        return this.datasetManager.removeDataset(id);
    }

    public listDatasets(): Promise<InsightDataset[]> {
        return this.datasetManager.listDatasets();
    }

    public performQuery(query: any): Promise<any[]> {
        this.queryEngine = new QueryEngine(this.datasetManager.getDatasets());
        return this.queryEngine.performQuery(query);
    }
}
