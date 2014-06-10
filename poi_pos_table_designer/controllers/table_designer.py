# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#    Copyright (C) 2011-2013 Serpent Consulting Services Pvt. Ltd. (<http://serpentcs.com>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

import datetime
import json
import logging
import select
import time

import openerp
import openerp.tools.config
import openerp.modules.registry
from openerp import http
from openerp.http import request
from openerp.tools.translate import _

_logger = logging.getLogger(__name__)

class TableController(http.Controller):

    @http.route('/poi_pos_table_designer/get_tables_state', type='json', auth='user')
    def get_tables_state(self, tables, **kw):
        result = {'error': False, 'tables_state': {}}
        table_obj = request.registry['table.table']
        for table in table_obj.browse(request.cr, request.uid, tables):
            result['tables_state'][table.id]=table.state
        return result

    @http.route('/poi_pos_table_designer/get_orders_with_state_timestamp', type='json', auth='user')
    def get_orders_with_state_timestamp(self, tables, **kw):
        res = {}
        order_pool = request.registry['pos.order']
        order_ids = order_pool.search(request.cr, request.uid, ['&',('table_ids','in',tables),('state','=','draft')])

        for order in order_pool.browse(request.cr,request.uid,order_ids):
            creation_date = order.get_last_state_timestamp()[order.id]['creation_date']
            name = order.name

            for table in order.table_ids:
                if not res.get(table.id):
                    res[table.id] = {order.id: {'creation_date': creation_date, 'name': name}}
                else:
                    res[table.id][order.id] = {'creation_date': creation_date, 'name': name}

        return res