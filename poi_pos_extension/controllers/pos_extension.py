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
from openerp.osv import osv, fields, expression
from openerp.tools.misc import DEFAULT_SERVER_DATETIME_FORMAT

_logger = logging.getLogger(__name__)

class OrderController(http.Controller):

    @http.route('/poi_pos_extension/get_order_ids', type='json', auth='user')
    def get_order_ids(self, domain=[], context={}):
        result = {}
        order_obj = request.registry['pos.order']
        order_ids = order_obj.search(request.cr, request.uid, domain, order='id', context=context)
        orders = order_obj.read(request.cr, request.uid, order_ids, ['timestamp'])

        result = {'orders': orders}
        return result

    @http.route('/poi_pos_extension/get_order_data', type='json', auth='user')
    def get_order_data(self, order_id):
        result = {}
        order_obj = request.registry['pos.order']

        result = order_obj.read(request.cr, request.uid, order_id)
        return result

    @http.route('/poi_pos_extension/get_orderline_data', type='json', auth='user')
    def get_orderline_data(self, order_id):
        result = {}
        order_line_obj = request.registry['pos.order.line']

        orderline_ids = order_line_obj.search(request.cr, request.uid, [('order_id','=',order_id)])

        result = order_line_obj.read(request.cr, request.uid, orderline_ids)
        return result

    @http.route('/poi_pos_extension/get_orders_timestamp', type='json', auth='user')
    def get_orders_timestamp(self, order_ids, **kw):
        result = {}
        order_obj = request.registry['pos.order']

        try:
            for order in order_obj.browse(request.cr, request.uid, order_ids):
                result[order.id]=order.timestamp
        except:
            pass
        return result