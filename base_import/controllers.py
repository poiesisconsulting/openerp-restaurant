# -*- coding: utf-8 -*-
import simplejson

from openerp.http import Controller, route, request

class ImportController(Controller):
    @route('/base_import/set_file')
    def set_file(self, file, import_id, jsonp='callback'):
        import_id = int(import_id)

        written = request.session.model('base_import.import').write(import_id, {
            'file': file.read(),
            'file_name': file.filename,
            'file_type': file.content_type,
        }, request.context)

        return 'window.top.%s(%s)' % (
            jsonp, simplejson.dumps({'result': written}))
