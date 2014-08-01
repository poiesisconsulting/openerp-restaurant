# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
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

from openerp.osv import fields, osv
import time

from datetime import date, timedelta, datetime

class sp_report(osv.osv_memory):
    _name = 'sp.report'

    _columns = {
        'start_date': fields.date('Start date', required=True),
        'end_date': fields.date('End date', required=True),
    }

    _defaults = {
        'start_date': fields.date.context_today,
        'end_date': fields.date.context_today,
    }

    def print_report(self, cr, uid, ids, context=None):
        if context is None:
            context = {}
        data = {
            'ids': context.get('active_ids', []),
            'model': context.get('active_model', 'ir.ui.menu'),
            'form': self.read(cr, uid, ids, ['start_date', 'end_date'], context=context)[0]
        }
        return self.pool['report'].get_action(cr, uid, ids, 'poi_x_hph.sp_report', data=data, context=context)