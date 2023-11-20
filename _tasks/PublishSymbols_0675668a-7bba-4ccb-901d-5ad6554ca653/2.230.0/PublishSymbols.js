"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const fs = require("fs");
const path = require("path");
const uuidV4 = require("uuid/v4");
const telemetry = require("azure-pipelines-tasks-utility-common/telemetry");
const clientToolUtils = require("azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities");
const clientToolRunner = require("azure-pipelines-tasks-packaging-common/universal/ClientToolRunner");
const tl = require("azure-pipelines-task-lib/task");
const symbolRequestAlreadyExistsError = 17;
function run(clientToolFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get the inputs.
            tl.debug("Getting client tool inputs");
            let AsAccountName = tl.getVariable("ArtifactServices.Symbol.AccountName");
            let symbolServiceUri = "https://" + encodeURIComponent(AsAccountName) + ".artifacts.visualstudio.com";
            let personalAccessToken;
            if (AsAccountName) {
                personalAccessToken = tl.getVariable("ArtifactServices.Symbol.PAT");
            }
            else {
                personalAccessToken = clientToolUtils.getSystemAccessToken();
                const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
                symbolServiceUri = yield getSymbolServiceUri(serviceUri, personalAccessToken);
            }
            let defaultSymbolFolder = tl.getVariable("Build.SourcesDirectory") ? tl.getVariable("Build.SourcesDirectory") : "";
            let symbolsFolder = tl.getInput("SymbolsFolder", false) ? tl.getInput("SymbolsFolder", false) : defaultSymbolFolder;
            let uniqueId = tl.getVariable("Build.UniqueId") ? tl.getVariable("Build.UniqueId") : uuidV4();
            let searchPatterns = tl.getDelimitedInput("SearchPattern", "\n", false) ? tl.getDelimitedInput("SearchPattern", "\n", false) : ["**\\bin\\**\\*.pdb"];
            let indexableFileFormats = tl.getInput("IndexableFileFormats", false);
            // If SymbolsArtifactName input is not the default value, use that as the request name instead of the default
            let symbolsArtifactName = tl.getInput("SymbolsArtifactName", false);
            let requestName;
            let defaultArtifactName = tl.getVariable("BuildConfiguration") ? "Symbols_" + tl.getVariable("BuildConfiguration") : "Symbols_$(BuildConfiguration)";
            if (symbolsArtifactName && symbolsArtifactName !== defaultArtifactName) {
                requestName = symbolsArtifactName;
            }
            else {
                requestName = (tl.getVariable("System.TeamProject") + "/" +
                    tl.getVariable("Build.DefinitionName") + "/" +
                    tl.getVariable("Build.BuildNumber") + "/" +
                    tl.getVariable("Build.BuildId") + "/" +
                    uniqueId).toLowerCase();
            }
            let expirationInDays = tl.getInput("SymbolExpirationInDays", false) ? tl.getInput("SymbolExpirationInDays", false) : '36530';
            let detailedLog = tl.getBoolInput("DetailedLog");
            // Determine specific files to publish, if provided
            let matches = tl.findMatch(symbolsFolder, searchPatterns);
            let fileList = matches.length > 0 ? matches.filter(function (testPath) {
                return fs.statSync(testPath).isFile();
            }) : [];
            console.log(tl.loc("FoundNFiles", fileList.length));
            if (fileList.length <= 0) {
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("NoFilesForPublishing"));
            }
            else {
                let execResult;
                if (fs.existsSync(clientToolFilePath)) {
                    tl.debug("Publishing the symbols");
                    tl.debug(`Using endpoint ${symbolServiceUri} to create request ${requestName} with content in ${symbolsFolder}`);
                    tl.debug(`Removing trailing '\/' in ${symbolServiceUri}`);
                    symbolServiceUri = clientToolUtils.trimEnd(symbolServiceUri, '/');
                    // Create temp file listing all files found
                    let tmpDir = tl.getVariable("Agent.TempDirectory");
                    let sourcePathListFileName = path.join(tmpDir, `ListOfSymbols-${uniqueId}.txt`);
                    fs.writeFileSync(sourcePathListFileName, fileList.join("\n"));
                    const publishOptions = {
                        clientToolFilePath,
                        detailedLog,
                        expirationInDays,
                        indexableFileFormats,
                        personalAccessToken,
                        requestName,
                        sourcePathListFileName,
                        symbolServiceUri
                    };
                    let toolRunnerOptions = clientToolRunner.getClientToolOptions();
                    execResult = publishSymbolsUsingClientTool(symbolsFolder, publishOptions, toolRunnerOptions);
                    if (fs.existsSync(sourcePathListFileName)) {
                        fs.unlinkSync(sourcePathListFileName);
                    }
                    if (execResult != null && execResult.code === symbolRequestAlreadyExistsError) {
                        telemetry.logResult("Symbols", "PublishingCommand", execResult.code);
                        throw new Error(tl.loc("Error_UnexpectedErrorSymbolsPublishing", execResult.code, execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
                    }
                    tl.setResult(tl.TaskResult.Succeeded, tl.loc("SymbolsPublishedSuccessfully") + execResult.stdout.trim());
                }
                else {
                    throw new Error(tl.loc("Error_SymbolPublishingToolNotFound", clientToolFilePath));
                }
            }
        }
        catch (error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToPublishSymbols", error.message));
        }
        finally {
            process.env.SYMBOL_PAT_AUTH_TOKEN = '';
        }
    });
}
exports.run = run;
function publishSymbolsUsingClientTool(sourcePath, options, execOptions) {
    const command = new Array();
    command.push("publish", "--service", options.symbolServiceUri, "--name", options.requestName, "--directory", sourcePath);
    if (options.expirationInDays) {
        command.push("--expirationInDays", options.expirationInDays);
    }
    if (options.personalAccessToken) {
        process.env.SYMBOL_PAT_AUTH_TOKEN = options.personalAccessToken;
        command.push("--patAuthEnvVar", 'SYMBOL_PAT_AUTH_TOKEN');
    }
    if (options.sourcePathListFileName) {
        command.push("--fileListFileName", options.sourcePathListFileName);
    }
    if (options.indexableFileFormats) {
        command.push("--indexableFileFormats", options.indexableFileFormats);
    }
    if (options.detailedLog) {
        command.push("--tracelevel", "verbose");
    }
    else {
        command.push("--tracelevel", "info");
    }
    command.push("--globalretrycount", "2");
    console.log(tl.loc("Info_ClientTool", options.clientToolFilePath));
    const execResult = clientToolRunner.runClientTool(options.clientToolFilePath, command, execOptions);
    if (execResult.code === 0 || execResult.code == symbolRequestAlreadyExistsError) {
        return execResult;
    }
    telemetry.logResult("Symbols", "PublishingCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorSymbolsPublishing", execResult.code, execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
function getSymbolServiceUri(collectionUri, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        let locationServiceUri = yield clientToolUtils.getServiceUriFromAreaId(collectionUri, accessToken, "951917ac-a960-4999-8464-e3f0aa25b381");
        let artifactsUri;
        if (locationServiceUri) {
            artifactsUri = yield clientToolUtils.getServiceUriFromAreaId(locationServiceUri, accessToken, "00000016-0000-8888-8000-000000000000");
        }
        else {
            let baseRegEx = new RegExp("\\.(visualstudio\\.com|vsts\\.me)");
            if (collectionUri.match(baseRegEx)) {
                artifactsUri = collectionUri.replace(baseRegEx, ".artifacts.$1");
            }
            else {
                let regEx = new RegExp("://[^/]+/([^/]+)");
                artifactsUri = collectionUri.replace(regEx, "://$1.artifacts.visualstudio.com");
            }
        }
        return artifactsUri;
    });
}
//# sourceMappingURL=PublishSymbols.js.map