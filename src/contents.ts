// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import * as utils from './utils';
import * as validate from './validate';


/**
 * The url for the contents service.
 */
var SERVICE_CONTENTS_URL = 'api/contents';


/**
 * Options for a contents object.
 */
export
interface IContentsOpts {
  type?: string;
  format?: string;
  content?: any;
  ext?: string;
  name?: string;
}


/**
 * Contents model.
 */
export 
interface IContentsModel {
  name: string;
  path: string;
  type: string;
  writable?: boolean;
  created: string;
  last_modified: string;
  mimetype: string;
  content: string;
  format: string;
}


/**
 * Checkpoint model.
 */
export 
interface ICheckpointModel {
  id: string;
  last_modified: string;
}


/**
 * Interface that a content manager should implement.
 **/
export 
interface IContents {
  get(path: string, type: string, options: IContentsOpts): Promise<IContentsModel>;
  newUntitled(path: string, options: IContentsOpts): Promise<IContentsModel>;
  delete(path: string): Promise<void>;
  rename(path: string, newPath: string): Promise<IContentsModel>;
  save(path: string, model: any): Promise<IContentsModel>;
  listContents(path: string): Promise<IContentsModel>;
  copy(path: string, toDir: string): Promise<IContentsModel>;
  createCheckpoint(path: string): Promise<ICheckpointModel>;
  restoreCheckpoint(path: string, checkpointID: string): Promise<void>;
  deleteCheckpoint(path: string, checkpointID: string): Promise<void>
  listCheckpoints(path: string): Promise<ICheckpointModel[]>;
}


/**
 * A contents handle passing file operations to the back-end.  
 * This includes checkpointing with the normal file operations.
 */
export 
class Contents implements IContents {

  /**
   * Create a new contents object.
   */
  constructor(baseUrl: string) {
    this._apiUrl = utils.urlPathJoin(baseUrl, SERVICE_CONTENTS_URL);
  }

  /**
   * Get a file or directory.
   */
  get(path: string, options: IContentsOpts): Promise<IContentsModel> {
    var settings = {
      method : "GET",
      dataType : "json",
    };
    var url = this._getUrl(path);
    var params: IContentsOpts = {};
    if (options.type) { params.type = options.type; }
    if (options.format) { params.format = options.format; }
    if (options.content === false) { params.content = '0'; }
    url = url + utils.jsonToQueryString(params);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): IContentsModel => {
      if (success.xhr.status !== 200) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      validate.validateContentsModel(success.data);
      return success.data;
    });
  }

  /**
   * Create a new untitled file or directory in the specified directory path.
   */
  newUntitled(path: string, options?: IContentsOpts): Promise<IContentsModel> {
    var settings: utils.IAjaxSettings = {
        method : "POST",
        dataType : "json",
    };
    if (options) {
      var data = JSON.stringify({
        ext: options.ext,
        type: options.type
      });
      settings.data = data;
      settings.contentType = 'application/json';
    }
    var url = this._getUrl(path);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): IContentsModel => {
      if (success.xhr.status !== 201) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      validate.validateContentsModel(success.data);
      return success.data;
    });
  }

  /**
   * Delete a file.
   */
  delete(path: string): Promise<void> {
    var settings = {
      method : "DELETE",
      dataType : "json",
    };
    var url = this._getUrl(path);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): void => {
      if (success.xhr.status !== 204) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
    }, // Translate certain errors to more specific ones.
      (error: utils.IAjaxError) => {
        // TODO: update IPEP27 to specify errors more precisely, so
        // that error types can be detected here with certainty.
        if (error.xhr.status === 400) {
          throw new Error('Directory not found');
        }
        throw new Error(error.xhr.statusText);
      }
    );
  }

  /**
   * Rename a file.
   */
  rename(path: string, newPath: string): Promise<IContentsModel> {
    var data = {path: newPath};
    var settings = {
      method : "PATCH",
      data : JSON.stringify(data),
      dataType: "json",
      contentType: 'application/json',
    };
    var url = this._getUrl(path);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): IContentsModel => {
      if (success.xhr.status !== 200) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      validate.validateContentsModel(success.data);
      return success.data;
    });
  }

  /**
   * Save a file.
   */
  save(path: string, model: IContentsOpts): Promise<IContentsModel> {
    var settings = {
      method : "PUT",
      dataType: "json",
      data : JSON.stringify(model),
      contentType: 'application/json',
    };
    var url = this._getUrl(path);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): IContentsModel => {
      // will return 200 for an existing file and 201 for a new file
      if (success.xhr.status !== 200 && success.xhr.status !== 201) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      validate.validateContentsModel(success.data);
      return success.data;
    });
  }
  
  /**
   * Copy a file into a given directory via POST
   * The server will select the name of the copied file.
   */
  copy(fromFile: string, toDir: string): Promise<IContentsModel> {
    var settings = {
      method: "POST",
      data: JSON.stringify({copy_from: fromFile}),
      contentType: 'application/json',
      dataType : "json",
    };
    var url = this._getUrl(toDir);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): IContentsModel => {
      if (success.xhr.status !== 201) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      validate.validateContentsModel(success.data);
      return success.data;
    });
  }

  /**
   * Create a checkpoint for a file.
   */
  createCheckpoint(path: string): Promise<ICheckpointModel> {
    var settings = {
      method : "POST",
      dataType : "json",
    };
    var url = this._getUrl(path, 'checkpoints');
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): ICheckpointModel => {
      if (success.xhr.status !== 201) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      validate.validateCheckpointModel(success.data);
      return success.data;
    });
  }

  /** 
   * List available checkpoints for a file.
   */
  listCheckpoints(path: string): Promise<ICheckpointModel[]> {
    var settings = {
      method : "GET",
      dataType: "json",
    };
    var url = this._getUrl(path, 'checkpoints');
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): ICheckpointModel[] => {
      if (success.xhr.status !== 200) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
      if (!Array.isArray(success.data)) {
        throw Error('Invalid Checkpoint list');
      }
      for (var i = 0; i < success.data.length; i++) {
        validate.validateCheckpointModel(success.data[i]);
      }
      return success.data;
    });
  }

  /**
   * Restore a file to a known checkpoint state.
   */
  restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    var settings = {
      method : "POST",
      dataType: "json",
    };
    var url = this._getUrl(path, 'checkpoints', checkpointID);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): void => {
      if (success.xhr.status !== 204) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
    });

  }

  /**
   * Delete a checkpoint for a file.
   */
  deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    var settings = {
      method : "DELETE",
      dataType: "json",
    };
    var url = this._getUrl(path, 'checkpoints', checkpointID);
    return utils.ajaxRequest(url, settings).then((success: utils.IAjaxSuccess): void => {
      if (success.xhr.status !== 204) {
        throw Error('Invalid Status: ' + success.xhr.status);
      }
    });
  }

  /** 
   * List notebooks and directories at a given path.
   */
  listContents(path: string): Promise<IContentsModel> {
    return this.get(path, {type: 'directory'});
  }

  /**
   * Get an REST url for this file given a path.
   */
  private _getUrl(...args: string[]): string {
    var url_parts = [].concat(
                Array.prototype.slice.apply(args));
    return utils.urlPathJoin(this._apiUrl,
                             utils.urlJoinEncode.apply(null, url_parts));
  }

  private _apiUrl = "unknown";
}
