# -*- encoding: utf-8 -*-
##############################################################################
#
#    Poiesis Consulting, OpenERP Partner
#    Copyright (C) 2012 Poiesis Consulting (<http://www.poiesisconsulting.com>). All Rights Reserved.
#    Autor: Nicolas Bustillos
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see http://www.gnu.org/licenses/.
#
##############################################################################

from openerp.osv import osv
from openerp.osv import fields
from openerp import tools


class pos_table_daily_report(osv.osv):
    _name = "pos.table.daily.report"
    _description = "Daily Report"
    _auto = False
    
    _columns = {
        'order_id': fields.many2one('pos.order', 'Order', readonly=True),
        'user_id': fields.many2one('res.users', 'Server', readonly=True),
        'date_start': fields.date('Start date', readonly=True),
        'date_service': fields.char('Service date', readonly=True),
        'area': fields.char('Area', readonly=True),
        'tables': fields.char('Tables', readonly=True),
        'total': fields.float('Total w/o Tax', readonly=True),
        'total_incl': fields.float('Total', readonly=True),
        'tips': fields.float('Gratuity', readonly=True),
        'revenue': fields.float('Revenue', readonly=True),
        'cash': fields.float('CASH', readonly=True),
        'vs': fields.float('VISA', readonly=True),
        'ax': fields.float('AMEX', readonly=True),
        'mc': fields.float('MASTER CARD', readonly=True),
        'ds': fields.float('DISCOVER', readonly=True),
        'sp': fields.float('S&P', readonly=True),
        'session_id': fields.many2one('pos.session', 'Session', readonly=True),
        'state': fields.selection([('draft', 'New'),('cancel', 'Cancelled'),('paid', 'Paid'),('done', 'Posted'),('invoiced', 'Invoiced')],'Status', readonly=True),
        'state_session': fields.selection([('opening_control', 'Opening Control'),('opened', 'In Progress'),('closing_control', 'Closing Control'),('closed', 'Closed & Posted'),],'Session Status', readonly=True),
        'covers': fields.integer('Covers'),

    }
    _order = 'date_service desc'
    
    
    def init(self, cr):
        #ToDo: Make methods and Tip item dynamic and configurable!!!!
        tools.sql.drop_view_if_exists(cr, 'pos_table_daily_report')
        query_to_exe = """
            CREATE or replace view pos_table_daily_report as (
                select ps.start_at as date_start,to_char(ps.start_at,'MM/DD/YYYY') as date_service,area.name as area
                    ,tot.total,tot.total_incl,tot.tip as tips,(tot.total-tot.tip) as revenue,ps.state as state_session,pay.*,po.*
                from pos_order po inner join pos_session ps on ps.id=po.session_id
                 left outer join (select pol.order_id,sum(pol.price_subtotal) as total,sum(pol.price_subtotal_incl) as total_incl,sum(case when pol.product_id=5401 then pol.price_subtotal else 0 end) as tip
                        from pos_order_line pol
                        group by pol.order_id) tot on tot.order_id=po.id
                left outer join (select distinct tr.order_id,max(ta.name) as name
                        from table_pos_order_rel tr inner join table_table tt on tt.id=tr.table_id inner join table_area ta on ta.id=tt.area_id
                        group by tr.order_id) area on area.order_id=po.id
                left outer join (select sl.pos_statement_id as order_id,sum(case when sl.journal_id=5 or sl.journal_id=13 then sl.amount end) as cash,sum(case when sl.journal_id=8 then sl.amount end) as vs
                            ,sum(case when sl.journal_id=10 then sl.amount end) as ax,sum(case when sl.journal_id=9 then sl.amount end) as mc,sum(case when sl.journal_id=11 then sl.amount end) as ds,sum(case when sl.journal_id=12 then sl.amount end) as sp
                        from account_bank_statement_line sl inner join account_bank_statement st on st.id=sl.statement_id
                        group by sl.pos_statement_id) pay on pay.order_id=po.id
            )"""
        
        cr.execute(query_to_exe)


    def launch_form(self, cr, uid, ids, context=None):

        line = self.browse(cr, uid, ids[0], context=context)

        action_form = {
            'name': "Order",
            'view_mode': 'form',
            'view_type': 'form',
            'res_model': 'pos.order',
            'res_id': line.id,
            'type': 'ir.actions.act_window',
            'nodestroy': True,
            'domain': str([]),
            'target': 'new',
            'context': context,
        }
        return action_form
